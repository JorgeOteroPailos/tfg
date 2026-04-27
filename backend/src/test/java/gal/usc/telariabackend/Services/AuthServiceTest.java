package gal.usc.telariabackend.Services;

import gal.usc.telariabackend.Model.DTO.LoginRequest;
import gal.usc.telariabackend.Model.DTO.LoginResponse;
import gal.usc.telariabackend.Model.Exceptions.AlreadyExistingUserException;
import gal.usc.telariabackend.Model.RefreshToken;
import gal.usc.telariabackend.Model.User;
import gal.usc.telariabackend.Repository.RefreshTokenRepository;
import gal.usc.telariabackend.Repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.lang.reflect.Field;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Duration;
import java.util.Date;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private Authentication authentication;

    @Mock
    private UserDetails userDetails;

    private KeyPair keyPair;

    private AuthService authService;

    @BeforeEach
    void setUp() throws Exception {
        KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
        keyPairGenerator.initialize(2048);
        keyPair = keyPairGenerator.generateKeyPair();

        authService = new AuthService(
                userRepository,
                refreshTokenRepository,
                passwordEncoder,
                authenticationManager,
                keyPair
        );

        setPrivateField(authService, "accessTokenTTL", Duration.ofMinutes(30));
        setPrivateField(authService, "refreshTokenTTL", Duration.ofDays(7));
    }

    private void setPrivateField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    @Test
    void registerUser_WhenUserDoesNotExist_ShouldEncodePasswordSaveUserAndReturnLoginResponse() {
        User user = new User("userName", "test@test.com", "plain-password");

        LoginResponse expectedResponse = new LoginResponse()
                .accessToken("fake-access-token")
                .refreshToken("fake-refresh-token");

        when(userRepository.existsById("test@test.com")).thenReturn(false);
        when(passwordEncoder.encode("plain-password")).thenReturn("encoded-password");

        AuthService spyService = spy(authService);
        doReturn(expectedResponse).when(spyService).login(any(LoginRequest.class));

        LoginResponse result = spyService.registerUser(user);

        assertNotNull(result);
        assertEquals("fake-access-token", result.getAccessToken());
        assertEquals("fake-refresh-token", result.getRefreshToken());

        assertEquals("encoded-password", user.password);

        verify(userRepository).existsById("test@test.com");
        verify(passwordEncoder).encode("plain-password");
        verify(userRepository).save(user);
        verify(spyService).login(any(LoginRequest.class));
    }

    @Test
    void registerUser_WhenUserDoesNotExist_ShouldCallLoginWithOriginalPassword() {
        User user = new User("userName", "test@test.com", "plain-password");

        LoginResponse expectedResponse = new LoginResponse()
                .accessToken("fake-access-token")
                .refreshToken("fake-refresh-token");

        when(userRepository.existsById("test@test.com")).thenReturn(false);
        when(passwordEncoder.encode("plain-password")).thenReturn("encoded-password");

        AuthService spyService = spy(authService);
        doReturn(expectedResponse).when(spyService).login(any(LoginRequest.class));

        spyService.registerUser(user);

        ArgumentCaptor<LoginRequest> loginRequestCaptor =
                ArgumentCaptor.forClass(LoginRequest.class);

        verify(spyService).login(loginRequestCaptor.capture());

        LoginRequest capturedLoginRequest = loginRequestCaptor.getValue();

        assertEquals("test@test.com", capturedLoginRequest.getEmail());
        assertEquals("plain-password", capturedLoginRequest.getPassword());
    }

    @Test
    void registerUser_WhenUserAlreadyExists_ShouldThrowExceptionAndNotSaveUser() {
        User user = new User("userName", "test@test.com", "plain-password");

        when(userRepository.existsById("test@test.com")).thenReturn(true);

        assertThrows(AlreadyExistingUserException.class, () -> authService.registerUser(user));

        verify(userRepository).existsById("test@test.com");
        verify(userRepository, never()).save(any(User.class));
        verify(passwordEncoder, never()).encode(anyString());
        verifyNoInteractions(authenticationManager);
        verifyNoInteractions(refreshTokenRepository);
    }

    @Test
    void login_WhenCredentialsAreCorrect_ShouldReturnAccessTokenAndRefreshToken() {
        LoginRequest loginRequest = new LoginRequest(
                "test@test.com",
                "plain-password"
        );

        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenReturn(authentication);

        when(authentication.getPrincipal())
                .thenReturn(userDetails);

        when(userDetails.getUsername())
                .thenReturn("test@test.com");

        LoginResponse result = authService.login(loginRequest);

        assertNotNull(result);
        assertNotNull(result.getAccessToken());
        assertFalse(result.getAccessToken().isBlank());

        assertNotNull(result.getRefreshToken());
        assertFalse(result.getRefreshToken().isBlank());

        verify(authenticationManager).authenticate(any(Authentication.class));
        verify(refreshTokenRepository).deleteAllByUseremail("test@test.com");
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void login_ShouldAuthenticateUsingEmailAndPasswordFromLoginRequest() {
        LoginRequest loginRequest = new LoginRequest(
                "test@test.com",
                "plain-password"
        );

        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenReturn(authentication);

        when(authentication.getPrincipal())
                .thenReturn(userDetails);

        when(userDetails.getUsername())
                .thenReturn("test@test.com");

        authService.login(loginRequest);

        ArgumentCaptor<Authentication> authenticationCaptor =
                ArgumentCaptor.forClass(Authentication.class);

        verify(authenticationManager).authenticate(authenticationCaptor.capture());

        Authentication capturedAuthentication = authenticationCaptor.getValue();

        assertEquals("test@test.com", capturedAuthentication.getPrincipal());
        assertEquals("plain-password", capturedAuthentication.getCredentials());
        assertFalse(capturedAuthentication.isAuthenticated());
    }

    @Test
    void login_ShouldGenerateJwtWithAuthenticatedUserEmailAsSubject() {
        LoginRequest loginRequest = new LoginRequest(
                "test@test.com",
                "plain-password"
        );

        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenReturn(authentication);

        when(authentication.getPrincipal())
                .thenReturn(userDetails);

        when(userDetails.getUsername())
                .thenReturn("test@test.com");

        LoginResponse result = authService.login(loginRequest);

        Claims claims = Jwts.parser()
                .verifyWith(keyPair.getPublic())
                .build()
                .parseSignedClaims(result.getAccessToken())
                .getPayload();

        assertEquals("test@test.com", claims.getSubject());
        assertNotNull(claims.getIssuedAt());
        assertNotNull(claims.getNotBefore());
        assertNotNull(claims.getExpiration());

        assertTrue(claims.getExpiration().after(new Date()));
    }

    @Test
    void login_ShouldDeletePreviousRefreshTokensBeforeSavingNewOne() {
        LoginRequest loginRequest = new LoginRequest(
                "test@test.com",
                "plain-password"
        );

        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenReturn(authentication);

        when(authentication.getPrincipal())
                .thenReturn(userDetails);

        when(userDetails.getUsername())
                .thenReturn("test@test.com");

        authService.login(loginRequest);

        var inOrder = inOrder(refreshTokenRepository);

        inOrder.verify(refreshTokenRepository).deleteAllByUseremail("test@test.com");
        inOrder.verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void login_ShouldSaveRefreshTokenForAuthenticatedUser() {
        LoginRequest loginRequest = new LoginRequest(
                "test@test.com",
                "plain-password"
        );

        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenReturn(authentication);

        when(authentication.getPrincipal())
                .thenReturn(userDetails);

        when(userDetails.getUsername())
                .thenReturn("test@test.com");

        LoginResponse result = authService.login(loginRequest);

        ArgumentCaptor<RefreshToken> refreshTokenCaptor =
                ArgumentCaptor.forClass(RefreshToken.class);

        verify(refreshTokenRepository).save(refreshTokenCaptor.capture());

        RefreshToken savedRefreshToken = refreshTokenCaptor.getValue();

        assertNotNull(savedRefreshToken);
        assertEquals(result.getRefreshToken(), savedRefreshToken.getToken());
        assertEquals("test@test.com", savedRefreshToken.getUseremail());
    }

    @Test
    void login_WhenAuthenticationFails_ShouldThrowExceptionAndNotCreateTokens() {
        LoginRequest loginRequest = new LoginRequest(
                "test@test.com",
                "wrong-password"
        );

        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        assertThrows(
                BadCredentialsException.class,
                () -> authService.login(loginRequest)
        );

        verify(authenticationManager).authenticate(any(Authentication.class));
        verifyNoInteractions(refreshTokenRepository);
    }

    @Test
    void logoutShouldDeleteRefreshTokens() {
        String email = "test@test.com";

        authService.logout(email);

        verify(refreshTokenRepository)
                .deleteAllByUseremail(email);
    }
}
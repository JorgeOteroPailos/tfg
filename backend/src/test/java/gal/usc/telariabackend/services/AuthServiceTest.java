package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.dto.LoginRequest;
import gal.usc.telariabackend.model.dto.LoginResponse;
import gal.usc.telariabackend.model.dto.RefreshResponse;
import gal.usc.telariabackend.model.exceptions.AlreadyExistingUserException;
import gal.usc.telariabackend.model.exceptions.InvalidRefreshTokenException;
import gal.usc.telariabackend.model.RefreshToken;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.repository.RefreshTokenRepository;
import gal.usc.telariabackend.repository.UserRepository;

import java.lang.reflect.Field;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;

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

    private KeyPair keyPair;

    private AuthService authService;


    @BeforeEach
    void setUp() throws Exception {
        KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
        keyPairGenerator.initialize(2048);
        keyPair = keyPairGenerator.generateKeyPair();

        com.nimbusds.jose.jwk.JWK jwk = new com.nimbusds.jose.jwk.RSAKey.Builder((java.security.interfaces.RSAPublicKey) keyPair.getPublic())
                .privateKey(keyPair.getPrivate())
                .keyID(java.util.UUID.randomUUID().toString())
                .build();
        com.nimbusds.jose.jwk.source.JWKSource<com.nimbusds.jose.proc.SecurityContext> jwks =
                new com.nimbusds.jose.jwk.source.ImmutableJWKSet<>(new com.nimbusds.jose.jwk.JWKSet(jwk));

        JwtEncoder jwtEncoder = new org.springframework.security.oauth2.jwt.NimbusJwtEncoder(jwks);

        authService = new AuthService(
                userRepository,
                refreshTokenRepository,
                passwordEncoder,
                authenticationManager,
                jwtEncoder
        );

        setPrivateField(authService, Duration.ofMinutes(30));
    }

    private void setPrivateField(Object target, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField("accessTokenTTL");
        field.setAccessible(true);
        field.set(target, value);
    }

    @Test
    void registerUser_WhenUserDoesNotExist_ShouldEncodePasswordSaveUserAndReturnLoginResponse() {
        User user = new User("userName", "test@test.com", "plain-password");

        LoginResponse expectedResponse = new LoginResponse()
                .accessToken("fake-access-token")
                .refreshToken("fake-refresh-token");

        when(userRepository.existsByEmail("test@test.com")).thenReturn(false);
        when(passwordEncoder.encode("plain-password")).thenReturn("encoded-password");

        AuthService spyService = spy(authService);
        doReturn(expectedResponse).when(spyService).login(any(LoginRequest.class));

        LoginResponse result = spyService.registerUser(user);

        assertNotNull(result);
        assertEquals("fake-access-token", result.getAccessToken());
        assertEquals("fake-refresh-token", result.getRefreshToken());

        assertEquals("encoded-password", user.getPassword());

        verify(userRepository).existsByEmail("test@test.com");
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

        when(userRepository.existsByEmail("test@test.com")).thenReturn(false);
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

        when(userRepository.existsByEmail("test@test.com")).thenReturn(true);

        assertThrows(AlreadyExistingUserException.class, () -> authService.registerUser(user));

        verify(userRepository).existsByEmail("test@test.com");
        verify(userRepository, never()).save(any(User.class));
        verify(passwordEncoder, never()).encode(anyString());
        verifyNoInteractions(authenticationManager);
        verifyNoInteractions(refreshTokenRepository);
    }

    @Test
    void login_WhenCredentialsAreCorrect_ShouldReturnAccessTokenAndRefreshToken_andUsername() {
        LoginRequest loginRequest = new LoginRequest(
                "test@test.com",
                "plain-password"
        );
        UUID userId= UUID.randomUUID();

        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenReturn(authentication);

        when(userRepository.findByEmail("test@test.com"))
                .thenReturn(Optional.of(new User("userName", "test@test.com", "encoded-password",userId)));

        LoginResponse result = authService.login(loginRequest);

        assertNotNull(result);
        assertNotNull(result.getAccessToken());
        assertFalse(result.getAccessToken().isBlank());

        assertNotNull(result.getRefreshToken());
        assertFalse(result.getRefreshToken().isBlank());

        assertNotNull(result.getUsername());
        assertFalse(result.getUsername().isBlank());
        assertEquals("userName", result.getUsername());

        verify(authenticationManager).authenticate(any(Authentication.class));
        verify(refreshTokenRepository, never()).deleteAllByUserId(userId);
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

        when(userRepository.findByEmail("test@test.com"))
                .thenReturn(Optional.of(new User("userName", "test@test.com", "encoded-password")));

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

        UUID userId= UUID.randomUUID();

        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenReturn(authentication);

        when(userRepository.findByEmail("test@test.com"))
                .thenReturn(Optional.of(new User("userName", "test@test.com", "encoded-password", userId)));

        LoginResponse result = authService.login(loginRequest);

        var decoder = org.springframework.security.oauth2.jwt.NimbusJwtDecoder
                .withPublicKey((java.security.interfaces.RSAPublicKey) keyPair.getPublic())
                .build();

        org.springframework.security.oauth2.jwt.Jwt jwt = decoder.decode(result.getAccessToken());

        assertEquals(userId.toString(), jwt.getSubject());
        assertNotNull(jwt.getIssuedAt());
        assertNotNull(jwt.getExpiresAt());

        assertTrue(jwt.getExpiresAt().isAfter(java.time.Instant.now()));
    }

    @Test
    void login_ShouldNotDeletePreviousRefreshTokensBeforeSavingNewOne() {
        LoginRequest loginRequest = new LoginRequest(
                "test@test.com",
                "plain-password"
        );
        UUID userId= UUID.randomUUID();

        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenReturn(authentication);

        when(userRepository.findByEmail("test@test.com"))
                .thenReturn(Optional.of(new User("userName", "test@test.com", "encoded-password",userId)));

        authService.login(loginRequest);

        var inOrder = inOrder(refreshTokenRepository);

        inOrder.verify(refreshTokenRepository, never()).deleteAllByUserId(userId);
        inOrder.verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void login_ShouldSaveRefreshTokenForAuthenticatedUser() {
        LoginRequest loginRequest = new LoginRequest(
                "test@test.com",
                "plain-password"
        );
        UUID id=UUID.randomUUID();

        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenReturn(authentication);

        when(userRepository.findByEmail("test@test.com"))
                .thenReturn(Optional.of(new User("userName", "test@test.com", "encoded-password",id)));

        LoginResponse result = authService.login(loginRequest);

        ArgumentCaptor<RefreshToken> refreshTokenCaptor =
                ArgumentCaptor.forClass(RefreshToken.class);

        verify(refreshTokenRepository).save(refreshTokenCaptor.capture());

        RefreshToken savedRefreshToken = refreshTokenCaptor.getValue();

        assertNotNull(savedRefreshToken);
        assertEquals(result.getRefreshToken(), savedRefreshToken.getToken());
        assertEquals(id, savedRefreshToken.getUserId());
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
        UUID userId = UUID.randomUUID();

        authService.logout(userId);

        verify(refreshTokenRepository)
                .deleteAllByUserId(userId);
    }

    //###################/REFRESH##############
    @Test
    void refresh_WhenTokenIsValid_ShouldInvalidateOldTokenAndReturnNewPair() {
        UUID id =  UUID.randomUUID();
        String oldTokenString = "old-refresh-token";
        RefreshToken oldToken = new RefreshToken(oldTokenString, id);

        when(refreshTokenRepository.findByToken(oldTokenString))
                .thenReturn(Optional.of(oldToken));

        RefreshResponse result = authService.refresh(oldTokenString);

        assertNotNull(result);
        assertNotNull(result.getAccessToken());
        assertFalse(result.getAccessToken().isBlank());
        assertNotNull(result.getRefreshToken());
        assertFalse(result.getRefreshToken().isBlank());
        assertNotEquals(oldTokenString, result.getRefreshToken());

        var decoder = org.springframework.security.oauth2.jwt.NimbusJwtDecoder
                .withPublicKey((java.security.interfaces.RSAPublicKey) keyPair.getPublic())
                .build();

        org.springframework.security.oauth2.jwt.Jwt jwt = decoder.decode(result.getAccessToken());

        assertEquals(id.toString(), jwt.getSubject());
        assertNotNull(jwt.getIssuedAt());
        assertNotNull(jwt.getExpiresAt());

        assertTrue(jwt.getExpiresAt().isAfter(java.time.Instant.now()));

        ArgumentCaptor<RefreshToken> refreshTokenCaptor =
                ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).delete(oldToken);
        verify(refreshTokenRepository).save(refreshTokenCaptor.capture());

        RefreshToken savedToken = refreshTokenCaptor.getValue();
        assertEquals(id, savedToken.getUserId());
        assertNotEquals(oldTokenString, savedToken.getToken());
    }

    @Test
    void refresh_WhenTokenDoesNotExist_ShouldThrowExceptionAndNotTouchDB() {
        when(refreshTokenRepository.findByToken("token-inventado"))
                .thenReturn(Optional.empty());

        assertThrows(
                InvalidRefreshTokenException.class,
                () -> authService.refresh("token-inventado")
        );

        verify(refreshTokenRepository, never()).save(any(RefreshToken.class));
        verify(refreshTokenRepository, never()).delete(any(RefreshToken.class));
    }

    @Test
    void refresh_WhenCalledTwiceWithRotation_BothResponsesShouldBeValid() {
        String firstTokenString = "first-refresh-token";
        String secondTokenString = "second-refresh-token";
        UUID userId =  UUID.randomUUID();

        RefreshToken firstToken = new RefreshToken(firstTokenString, userId);
        RefreshToken secondToken = new RefreshToken(secondTokenString, userId);

        when(refreshTokenRepository.findByToken(firstTokenString))
                .thenReturn(Optional.of(firstToken));
        when(refreshTokenRepository.findByToken(secondTokenString))
                .thenReturn(Optional.of(secondToken));

        var decoder = org.springframework.security.oauth2.jwt.NimbusJwtDecoder
                .withPublicKey((java.security.interfaces.RSAPublicKey) keyPair.getPublic())
                .build();

        RefreshResponse firstResult = authService.refresh(firstTokenString);

        assertNotNull(firstResult.getAccessToken());
        assertFalse(firstResult.getAccessToken().isBlank());
        assertNotNull(firstResult.getRefreshToken());
        assertNotEquals(firstTokenString, firstResult.getRefreshToken());

        org.springframework.security.oauth2.jwt.Jwt firstJwt = decoder.decode(firstResult.getAccessToken());
        assertEquals(userId.toString(), firstJwt.getSubject());
        assertNotNull(firstJwt.getExpiresAt());
        assertTrue(firstJwt.getExpiresAt().isAfter(java.time.Instant.now()));

        RefreshResponse secondResult = authService.refresh(secondTokenString);

        assertNotNull(secondResult.getAccessToken());
        assertFalse(secondResult.getAccessToken().isBlank());
        assertNotNull(secondResult.getRefreshToken());
        assertNotEquals(secondTokenString, secondResult.getRefreshToken());

        org.springframework.security.oauth2.jwt.Jwt secondJwt = decoder.decode(secondResult.getAccessToken());
        assertEquals(userId.toString(), secondJwt.getSubject());
        assertNotNull(secondJwt.getExpiresAt());
        assertTrue(secondJwt.getExpiresAt().isAfter(java.time.Instant.now()));

        verify(refreshTokenRepository).delete(firstToken);
        verify(refreshTokenRepository).delete(secondToken);
        verify(refreshTokenRepository, times(2)).save(any(RefreshToken.class));
    }
}
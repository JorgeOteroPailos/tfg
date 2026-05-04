package gal.usc.telariabackend.Services;

import gal.usc.telariabackend.Model.DTO.LoginRequest;
import gal.usc.telariabackend.Model.DTO.LoginResponse;
import gal.usc.telariabackend.Model.DTO.RefreshResponse;
import gal.usc.telariabackend.Model.Exceptions.AlreadyExistingUserException;
import gal.usc.telariabackend.Model.Exceptions.InvalidRefreshTokenException;
import gal.usc.telariabackend.Model.RefreshToken;
import gal.usc.telariabackend.Model.User;
import gal.usc.telariabackend.Repository.RefreshTokenRepository;
import gal.usc.telariabackend.Repository.UserRepository;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;

    private final RefreshTokenRepository refreshTokenRepository;

    private final PasswordEncoder passwordEncoder;

    private final JwtEncoder jwtEncoder;

    private final AuthenticationManager authenticationManager;

    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${auth.jwt.ttl:PT30M}")
    private Duration accessTokenTTL;

    public AuthService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtEncoder jwtEncoder
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.authenticationManager = authenticationManager;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
    }

    @Transactional
    public LoginResponse registerUser(User u)
            throws AlreadyExistingUserException {
        if (!userRepository.existsByEmail(u.getEmail())) {
            String unencodedPassword = u.getPassword();
            u.setPassword(passwordEncoder.encode(unencodedPassword));
            userRepository.save(u);

            LoginRequest loginRequest = new LoginRequest(
                    u.getEmail(),
                    unencodedPassword
            );
            return login(loginRequest);
        } else {
            throw new AlreadyExistingUserException(u.getEmail());
        }
    }

    @Transactional
    public LoginResponse login(LoginRequest loginRequest) {
        Authentication authRequest =
                UsernamePasswordAuthenticationToken.unauthenticated(
                        loginRequest.getEmail(),
                        loginRequest.getPassword()
                );

        authenticationManager.authenticate(authRequest);

        Instant now = Instant.now();

        String email = loginRequest.getEmail();
        User u = userRepository.findByEmail(email).orElseThrow();
        String username = u.getUsername();
        UUID id = u.getId();

        org.springframework.security.oauth2.jwt.JwtClaimsSet claims = org.springframework.security.oauth2.jwt.JwtClaimsSet.builder()
                .issuer("self")
                .issuedAt(now)
                .expiresAt(now.plus(accessTokenTTL))
                .subject(String.valueOf(id))
                .build();

        String accessToken = jwtEncoder.encode(org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(claims)).getTokenValue();

        String refreshTokenString = generateUniqueRefreshTokenString();

        RefreshToken refreshToken = new RefreshToken(
                refreshTokenString,
                id
        );

        refreshTokenRepository.save(refreshToken);

        return new LoginResponse().accessToken(accessToken).refreshToken(refreshToken.getToken()).username(username);
    }

    @Transactional
    public void logout(UUID id) {refreshTokenRepository.deleteAllByUserId(id);}

    @Transactional
    public RefreshResponse refresh(String refreshTokenString) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(refreshTokenString).orElseThrow(
                () -> new InvalidRefreshTokenException("Invalid Refresh Token"));

        refreshTokenRepository.delete(refreshToken);

        UUID userId = refreshToken.getUserId();
        Instant now = Instant.now();

        org.springframework.security.oauth2.jwt.JwtClaimsSet claims = org.springframework.security.oauth2.jwt.JwtClaimsSet.builder()
                .issuer("self")
                .issuedAt(now)
                .expiresAt(now.plus(accessTokenTTL))
                .subject(userId.toString())
                .build();

        String accessToken = jwtEncoder.encode(org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(claims)).getTokenValue();


        RefreshToken newRefreshToken = new RefreshToken(generateUniqueRefreshTokenString(), userId);
        refreshTokenRepository.save(newRefreshToken);

        return new RefreshResponse(accessToken, newRefreshToken.getToken());

    }

    //HELPERS
    private String generateUniqueRefreshTokenString() {
        String token;
        do {
            token = generateRefreshTokenString();
        } while (refreshTokenRepository.existsById(token));
        return token;
    }

    private String generateRefreshTokenString() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
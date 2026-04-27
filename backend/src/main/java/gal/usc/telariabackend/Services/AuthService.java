package gal.usc.telariabackend.Services;

import gal.usc.telariabackend.Model.DTO.LoginRequest;
import gal.usc.telariabackend.Model.DTO.LoginResponse;
import gal.usc.telariabackend.Model.Exceptions.AlreadyExistingUserException;
import gal.usc.telariabackend.Model.RefreshToken;
import gal.usc.telariabackend.Model.User;
import gal.usc.telariabackend.Repository.RefreshTokenRepository;
import gal.usc.telariabackend.Repository.UserRepository;
import io.jsonwebtoken.Jwts;
import java.security.KeyPair;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final KeyPair keyPair;

    private final UserRepository userRepository;

    private final RefreshTokenRepository refreshTokenRepository;

    private final PasswordEncoder passwordEncoder;

    private final AuthenticationManager authenticationManager;

    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${auth.jwt.ttl:PT30M}")
    private Duration accessTokenTTL;

    @Value("${auth.opaque.ttl:P7D}")
    private Duration refreshTokenTTL;

    public AuthService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            KeyPair keyPair
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.authenticationManager = authenticationManager;
        this.keyPair = keyPair;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public LoginResponse registerUser(User u)
            throws AlreadyExistingUserException {
        if (!userRepository.existsById(u.getEmail())) {
            String unencodedPassword = u.password;
            u.password = passwordEncoder.encode(u.password);
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

        Authentication authResult = authenticationManager.authenticate(
                authRequest
        );

        Object principal = authResult.getPrincipal();

        if (!(principal instanceof UserDetails userDetails)) {
            throw new IllegalStateException(
                    "Authentication principal is not a valid UserDetails"
            );
        }

        Instant now = Instant.now();

        String username = userDetails.getUsername();

        String accessToken = Jwts.builder()
                .subject(username)
                .issuedAt(Date.from(now))
                .notBefore(Date.from(now))
                .expiration(Date.from(now.plus(accessTokenTTL)))
                .signWith(keyPair.getPrivate())
                .compact();

        String refreshTokenString = generateRefreshTokenString();

        RefreshToken refreshToken = new RefreshToken(
                refreshTokenString,
                userDetails.getUsername()
        );

        refreshTokenRepository.deleteAllByUseremail(userDetails.getUsername());
        refreshTokenRepository.save(refreshToken);

        return new LoginResponse().accessToken(accessToken).refreshToken(refreshToken.getToken());
    }

    @Transactional
    public void logout(String email) {
        refreshTokenRepository.deleteAllByUseremail(email);
    }

    //HELPERS
    private String generateRefreshTokenString() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
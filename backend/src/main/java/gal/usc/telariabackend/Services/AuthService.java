package gal.usc.telariabackend.Services;

import gal.usc.telariabackend.Model.DTO.LoginRequest;
import gal.usc.telariabackend.Model.DTO.LoginResponse;
import gal.usc.telariabackend.Model.RefreshToken;
import gal.usc.telariabackend.Model.User;
import gal.usc.telariabackend.Repository.RefreshTokenRepository;
import gal.usc.telariabackend.Repository.UserRepository;
import io.jsonwebtoken.Jwts;
import java.security.KeyPair;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
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

    public LoginResponse registerUser(User u) {
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
            //TODO dar error o algo yoqse
            return null;
        }
    }

    @Transactional
    public LoginResponse login(LoginRequest loginRequest) {
        Authentication authRequest =
            UsernamePasswordAuthenticationToken.unauthenticated(
                loginRequest.email(),
                loginRequest.password()
            );

        Authentication authResult = authenticationManager.authenticate(
            authRequest
        );

        UserDetails userDetails = (UserDetails) authResult.getPrincipal();

        Instant now = Instant.now();

        //TODO if getUsername==null dar error? Me sale ese warning en el IDE pero ns cómo debe tratarse

        String accessToken = Jwts.builder()
            .subject(userDetails.getUsername())
            .issuedAt(Date.from(now))
            .notBefore(Date.from(now))
            .expiration(Date.from(now.plus(accessTokenTTL)))
            .signWith(keyPair.getPrivate())
            .compact();

        String refreshTokenString = UUID.randomUUID().toString();

        RefreshToken refreshToken = new RefreshToken(
            refreshTokenString,
            userDetails.getUsername(),
            refreshTokenTTL.toSeconds()
        );

        refreshTokenRepository.deleteAllByUseremail(userDetails.getUsername());
        refreshTokenRepository.save(refreshToken);

        return new LoginResponse(accessToken, refreshToken.getToken());
    }
}

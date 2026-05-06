package gal.usc.telariabackend.configuration;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import gal.usc.telariabackend.repository.UserRepository;
import java.io.InputStream;
import java.security.KeyPair;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.expression.ExpressionException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) {
        http
            .authorizeHttpRequests(auth ->
                auth
                    .requestMatchers("/auth/register", "/auth/login", "/auth/refresh")
                    .permitAll()
                    .requestMatchers("/h2-console/**")
                    .permitAll()
                    .anyRequest()
                    .authenticated()
            )
            .oauth2ResourceServer(oauth2 ->
                oauth2.jwt(Customizer.withDefaults())
            )
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .csrf(AbstractHttpConfigurer::disable)
            .headers(headers ->
                headers.frameOptions(
                    HeadersConfigurer.FrameOptionsConfig::sameOrigin
                )
            );

        return http.build();
    }

    @Bean
    public JwtDecoder jwtDecoder(KeyPair keyPair) {
        return NimbusJwtDecoder.withPublicKey(
            (RSAPublicKey) keyPair.getPublic()
        ).build();
    }

    @Bean
    public JwtEncoder jwtEncoder(KeyPair keyPair) {
        RSAKey rsaKey = new RSAKey.Builder((RSAPublicKey) keyPair.getPublic())
            .privateKey((RSAPrivateKey) keyPair.getPrivate())
            .build();

        JWKSource<SecurityContext> jwkSource = new ImmutableJWKSet<>(
            new JWKSet(rsaKey)
        );

        return new NimbusJwtEncoder(jwkSource);
    }

    @Bean
    public AuthenticationManager authenticationManager(
        UserDetailsService userDetailsService,
        PasswordEncoder passwordEncoder
    ) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(
            userDetailsService
        );
        provider.setPasswordEncoder(passwordEncoder);

        return new ProviderManager(provider);
    }

    @Bean
    public UserDetailsService userDetailsService(
        UserRepository userRepository
    ) {
        return username -> {
            var u = userRepository
                .findByEmail(username)
                .orElseThrow(() ->
                    new ExpressionException("Usuario no encontrado")
                ); //TODO hacer algo con la excepción

            return org.springframework.security.core.userdetails.User.withUsername(
                u.getEmail()
            )
                .password(u.getPassword())
                .build();
        };
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Value("${keystore.location}")
    private String ksLocation;

    @Value("${keystore.password}")
    private String ksPassword;

    @Value("${keystore.private.name}")
    private String keyName;

    @Value("${keystore.private.password}")
    private String keyPassword;

    @Bean
    public KeyPair keyPair() {
        try {
            KeyStore ks = KeyStore.getInstance("PKCS12");

            try (
                InputStream is = new ClassPathResource(
                    ksLocation
                ).getInputStream()
            ) {
                ks.load(is, ksPassword.toCharArray());
            }

            var cert = ks.getCertificate(keyName);
            if (cert == null) {
                throw new IllegalStateException(
                    "There is not a certificate with alias: " + keyName
                );
            }

            var key = ks.getKey(keyName, keyPassword.toCharArray());
            if (!(key instanceof PrivateKey privateKey)) {
                throw new IllegalStateException(
                    "Alia's key is not a PrivateKey: " + keyName
                );
            }

            return new KeyPair(cert.getPublicKey(), privateKey);
        } catch (Exception e) {
            throw new IllegalStateException(
                "JWT KeyPair couldn't be loaded",
                e
            );
        }
    }
}

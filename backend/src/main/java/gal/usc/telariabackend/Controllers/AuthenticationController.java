package gal.usc.telariabackend.Controllers;

import gal.usc.telariabackend.Model.DTO.*;
import gal.usc.telariabackend.Model.User;
import gal.usc.telariabackend.Services.AuthService;
import gal.usc.telariabackend.utils.SecurityHelper;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
public class AuthenticationController implements AuthApi {
    private final AuthService authService;

    private final SecurityHelper securityHelper;

    private static final Logger log = LoggerFactory.getLogger(AuthenticationController.class);

    public AuthenticationController(AuthService authService, SecurityHelper securityHelper) {
        this.authService = authService;
        this.securityHelper = securityHelper;
    }

    @Override
    public ResponseEntity<LoginResponse> registerUser(@Valid @RequestBody RegisterRequest registerRequest) {
        log.debug("Registering user {}", registerRequest);
        User u = new User(registerRequest);
        LoginResponse loginResponse = authService.registerUser(u);
        return ResponseEntity.status(HttpStatus.CREATED).body(loginResponse);
    }

    @Override
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest loginRequest) {
        log.debug("Logining user {}", loginRequest);
        LoginResponse loginResponse=authService.login(loginRequest);
        return ResponseEntity.ok(loginResponse);
    }

    @Override
    public ResponseEntity<Void> logout() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        log.debug("Logout user {}", auth);
        authService.logout(securityHelper.getEmail());
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<RefreshResponse> refreshTokens(@RequestBody RefreshRequest refreshRequest) {
        RefreshResponse response = authService.refresh(refreshRequest.getRefreshToken());
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

}

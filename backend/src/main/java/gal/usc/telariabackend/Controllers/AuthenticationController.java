package gal.usc.telariabackend.Controllers;

import gal.usc.telariabackend.Model.DTO.LoginRequest;
import gal.usc.telariabackend.Model.DTO.LoginResponse;
import gal.usc.telariabackend.Model.DTO.RegisterRequest;
import gal.usc.telariabackend.Model.User;
import gal.usc.telariabackend.Services.AuthService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("auth")
public class AuthenticationController {
    private final AuthService authService;

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    public AuthenticationController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("register")
    public ResponseEntity<LoginResponse> registerUser(@Valid @RequestBody RegisterRequest registerRequest) {
        log.debug("Registering user {}", registerRequest);
        User u = new User(registerRequest);
        LoginResponse loginResponse = authService.registerUser(u);
        return ResponseEntity.status(HttpStatus.CREATED).body(loginResponse);
    }

    @PostMapping("login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest loginRequest) {
        log.debug("Logining user {}", loginRequest);
        LoginResponse loginResponse=authService.login(loginRequest);
        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("logout")
    public ResponseEntity<Void> logout(Authentication auth) {
        log.debug("Logout user {}", auth);
        authService.logout(auth.getName());
        return ResponseEntity.noContent().build();
    }



}

package gal.usc.telariabackend.Controllers;

import gal.usc.telariabackend.Model.DTO.*;
import gal.usc.telariabackend.Model.User;
import gal.usc.telariabackend.Services.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("auth")
public class AuthenticationController implements AuthApi {
    private final AuthService authService;

    public AuthenticationController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("register")
    public ResponseEntity<LoginResponse> registerUser(@Valid @RequestBody RegisterRequest registerRequest) {
        User u = new User(registerRequest);
        LoginResponse loginResponse = authService.registerUser(u);
        return ResponseEntity.status(HttpStatus.CREATED).body(loginResponse);
    }

    @PostMapping("login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest loginRequest) {
        LoginResponse loginResponse=authService.login(loginRequest);
        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("logout")
    public ResponseEntity<Void> logout(Authentication auth) {
        authService.logout(auth.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("refresh")
    public ResponseEntity<RefreshResponse> refreshTokens(@RequestBody RefreshRequest refreshRequest) {
        RefreshResponse response = authService.refresh(refreshRequest.getRefreshToken());
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

}

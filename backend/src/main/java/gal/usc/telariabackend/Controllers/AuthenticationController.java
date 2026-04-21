package gal.usc.telariabackend.Controllers;

import gal.usc.telariabackend.Model.DTO.LoginRequest;
import gal.usc.telariabackend.Model.DTO.LoginResponse;
import gal.usc.telariabackend.Model.DTO.RegisterRequest;
import gal.usc.telariabackend.Model.User;
import gal.usc.telariabackend.Services.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("auth")
public class AuthenticationController {
    private final AuthService authService;

    public AuthenticationController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("signin")
    public ResponseEntity<LoginResponse> registerUser(@RequestBody RegisterRequest registerRequest) {
        User u = new User(registerRequest);
        LoginResponse loginResponse = authService.registerUser(u);
        return ResponseEntity.status(HttpStatus.CREATED).body(loginResponse);
    }

    @PostMapping("login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest loginRequest) {
        LoginResponse loginResponse=authService.login(loginRequest);
        return ResponseEntity.ok(loginResponse);
    }



}

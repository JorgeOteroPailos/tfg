package gal.usc.telariabackend.Controllers;

import gal.usc.telariabackend.controllers.UsersApi;
import gal.usc.telariabackend.model.DTO.User;
import gal.usc.telariabackend.Services.UserService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController implements UsersApi {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @Override
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }


}

package gal.usc.telariabackend.services;


import gal.usc.telariabackend.model.dto.User;
import gal.usc.telariabackend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<User> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(u -> new User()
                        .email(u.getEmail())
                        .username(u.getUsername()))
                .toList();
    }
}

package gal.usc.telariabackend.model;

import gal.usc.telariabackend.model.dto.RegisterRequest;
import jakarta.persistence.*;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Entity
@Table(name="users")
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class User {

    private String username;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @Column(unique=true)
    private String email;

    @Setter
    private String password;

    public User() {

    }

    public User(String username, String email, String password) {
        this.username = username;
        this.email = email;
        this.password = password;
    }

    public User(String username, String email, String password, UUID id) {
        this.username = username;
        this.email = email;
        this.password = password;
        this.id = id;
    }

    public User(RegisterRequest registerRequest) {
        this.username = registerRequest.getUsername();
        this.email = registerRequest.getEmail();
        this.password = registerRequest.getPassword();
    }

}
package gal.usc.telariabackend.model;

import gal.usc.telariabackend.model.dto.RegisterRequest;
import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name="users")
public class User {

    private String username;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique=true)
    private String email;

    private String password;

    public String getEmail() {return email;}

    public String getUsername() {return username;}

    public String getPassword() { return password; }
    public void setPassword(String encoded) { this.password = encoded; }

    public UUID getId() {return id;}

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
package gal.usc.telariabackend.Model;

import gal.usc.telariabackend.Model.DTO.RegisterRequest;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name="users")
public class User {

    private String username;

    @Id
    private String email;

    public String password;

    public String getEmail() {return email;}

    public User() {

    }

    public User(String username, String email, String password) {
        this.username = username;
        this.email = email;
        this.password = password;
    }

    public User(RegisterRequest registerRequest) {
        this.username = registerRequest.getUsername();
        this.email = registerRequest.getEmail();
        this.password = registerRequest.getPassword();
    }

}
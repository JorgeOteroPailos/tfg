package gal.usc.telariabackend.model;

import gal.usc.telariabackend.model.dto.OwnProfile;
import gal.usc.telariabackend.model.dto.RegisterRequest;
import gal.usc.telariabackend.model.dto.UserProfile;
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

    @Setter
    private String username;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @Setter
    @Column(unique=true)
    private String email;

    @Setter
    private String password;

    @Setter
    private String avatarObjectKey;

    @Setter
    private String pendingAvatarObjectKey;

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

    public UserProfile toUserProfile() {
        return new UserProfile().id(this.id).username(this.username).hasAvatar(this.avatarObjectKey != null);
    }

    public OwnProfile toOwnProfile() {
        return new OwnProfile()
                .id(this.id)
                .username(this.username)
                .email(this.email)
                .hasAvatar(this.avatarObjectKey != null);
    }

}
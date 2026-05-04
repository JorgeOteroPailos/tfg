package gal.usc.telariabackend.Model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "refreshtokens")
public class RefreshToken {

    @Id
    private String token;

    private UUID userId;

    public RefreshToken() {}

    public RefreshToken(String token, UUID userId) {
        this.token = token;
        this.userId = userId;
    }

    public String getToken() {
        return token;
    }

    public UUID getUserId() {return userId;}
}

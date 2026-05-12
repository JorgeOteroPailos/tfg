package gal.usc.telariabackend.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.EqualsAndHashCode;
import lombok.Getter;

import java.util.UUID;

@Getter
@Entity
@Table(name = "refreshtokens")
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class RefreshToken{

    @Id
    @EqualsAndHashCode.Include
    private String token;

    private UUID userId;

    public RefreshToken() {}

    public RefreshToken(String token, UUID userId) {
        this.token = token;
        this.userId = userId;
    }

}

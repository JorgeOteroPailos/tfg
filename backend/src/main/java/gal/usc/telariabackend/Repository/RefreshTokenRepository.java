package gal.usc.telariabackend.Repository;

import gal.usc.telariabackend.Model.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {
    Optional<RefreshToken> findByToken(String token);

    void deleteAllByToken(String token);

    void deleteAllByUserId(UUID attr0);
}


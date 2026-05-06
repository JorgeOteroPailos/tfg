package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {
    Optional<RefreshToken> findByToken(String token);

    void deleteAllByToken(String token);

    void deleteAllByUserId(UUID attr0);
}


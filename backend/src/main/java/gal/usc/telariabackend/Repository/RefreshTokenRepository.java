package gal.usc.telariabackend.Repository;

import gal.usc.telariabackend.Model.RefreshToken;
import gal.usc.telariabackend.Model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {
    void deleteAllByUseremail(String username);

    Optional<RefreshToken> findByToken(String token);
}


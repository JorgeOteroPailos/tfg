package gal.usc.telariabackend.Repository;

import gal.usc.telariabackend.Model.RefreshToken;
import gal.usc.telariabackend.Model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {
    Optional<RefreshToken> findByUseremail(String useremail);

    void deleteAllByUseremail(String username);
}


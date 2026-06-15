package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.Friendship;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FriendshipRepository extends JpaRepository<Friendship, UUID> {

    @Query("SELECT f FROM Friendship f WHERE f.user1.id = :userId OR f.user2.id = :userId")
    List<Friendship> findAllByUserId(@Param("userId") UUID userId);

    @Query("SELECT f FROM Friendship f WHERE (f.user1.id = :a AND f.user2.id = :b) OR (f.user1.id = :b AND f.user2.id = :a)")
    Optional<Friendship> findByUserIds(@Param("a") UUID a, @Param("b") UUID b);

    @Query("SELECT CASE WHEN COUNT(f) > 0 THEN true ELSE false END FROM Friendship f WHERE (f.user1.id = :a AND f.user2.id = :b) OR (f.user1.id = :b AND f.user2.id = :a)")
    boolean existsByUserIds(@Param("a") UUID a, @Param("b") UUID b);
}

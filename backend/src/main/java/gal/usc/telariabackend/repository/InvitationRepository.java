package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.Invitation;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface InvitationRepository extends JpaRepository<Invitation, UUID> {
    @Query("SELECT i FROM Invitation i JOIN FETCH i.trip WHERE i.user.id = :userId")
    List<Invitation> findByUserId(@Param("userId") UUID userId);

    boolean existsByTripAndUser(Trip trip, User user);
}

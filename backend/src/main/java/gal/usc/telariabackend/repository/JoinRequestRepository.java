package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.JoinRequest;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.UUID;

public interface JoinRequestRepository extends JpaRepository<JoinRequest, UUID> {
    Collection<JoinRequest> findAllByTrip(Trip trip);

    boolean existsByTripAndUser(Trip trip, User user);

    @Transactional
    @Modifying
    @Query("DELETE FROM JoinRequest j WHERE j.trip.id = :tripId")
    void deleteAllByTripId(@Param("tripId") UUID tripId);

    @Transactional
    @Modifying
    @Query("DELETE FROM JoinRequest j WHERE j.user.id = :userId")
    void deleteAllByUserId(@Param("userId") UUID userId);
}

package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.JoinRequest;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.UUID;

public interface JoinRequestRepository extends JpaRepository<JoinRequest, UUID> {
    Collection<JoinRequest> findAllByTrip(Trip trip);

    boolean existsByTripAndUser(Trip trip, User user);
}

package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;


public interface TripRepository extends JpaRepository<Trip, UUID>{

    List<Trip> findAllByMembersId(UUID userId);

    Optional<Trip> findByIdAndMembersContaining(UUID tripId, User user);

    Optional<Trip> findByIdAndMembersId(UUID tripId, UUID userId);

    boolean existsByIdAndMembersId(UUID tripId, UUID userId);
}

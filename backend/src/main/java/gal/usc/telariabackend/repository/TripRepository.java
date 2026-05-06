package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;


public interface TripRepository extends JpaRepository<Trip, UUID>{


    List<Trip> findAllByMembersContaining(User u);
}

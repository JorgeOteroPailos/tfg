package gal.usc.telariabackend.Repository;

import gal.usc.telariabackend.Model.Trip;
import gal.usc.telariabackend.Model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;


public interface TripRepository extends JpaRepository<Trip, UUID>{


    List<Trip> findAllByMembersContaining(User u);
}

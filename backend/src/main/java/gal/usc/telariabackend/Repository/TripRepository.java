package gal.usc.telariabackend.Repository;

import gal.usc.telariabackend.Model.Trip;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface TripRepository extends JpaRepository<Trip, UUID>{

}

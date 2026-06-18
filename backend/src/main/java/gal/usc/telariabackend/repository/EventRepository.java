package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.Event;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EventRepository extends JpaRepository<Event, UUID> {
    List<Event> findByTripIdOrderByStartTimeAsc(UUID tripId);
}

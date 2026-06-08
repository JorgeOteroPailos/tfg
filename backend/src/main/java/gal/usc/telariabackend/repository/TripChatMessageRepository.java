package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.TripChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TripChatMessageRepository extends JpaRepository<TripChatMessage, UUID> {

    List<TripChatMessage> findByTripIdOrderByTimestampAsc(UUID tripId);
}

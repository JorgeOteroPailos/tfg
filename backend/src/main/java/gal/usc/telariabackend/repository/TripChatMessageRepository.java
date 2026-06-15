package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.TripChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface TripChatMessageRepository extends JpaRepository<TripChatMessage, UUID> {

    List<TripChatMessage> findByTripIdOrderByTimestampAsc(UUID tripId);

    @Transactional
    @Modifying
    @Query("DELETE FROM TripChatMessage m WHERE m.trip.id = :tripId")
    void deleteAllByTripId(@Param("tripId") UUID tripId);

    @Transactional
    @Modifying
    @Query("DELETE FROM TripChatMessage m WHERE m.timestamp < :cutoff")
    void deleteByTimestampBefore(@Param("cutoff") OffsetDateTime cutoff);

    @Transactional
    @Modifying
    @Query("DELETE FROM TripChatMessage m WHERE m.user.id = :userId")
    void deleteAllByUserId(@Param("userId") UUID userId);
}

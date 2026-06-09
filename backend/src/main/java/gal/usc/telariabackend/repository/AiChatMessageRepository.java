package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.AiChatMessage;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface AiChatMessageRepository
    extends JpaRepository<AiChatMessage, UUID>
{
    // Used for Ollama context window (last 5 messages)
    List<AiChatMessage> findTop5ByTripIdAndUserIdOrderByTimestampDesc(
        UUID tripId,
        UUID userId
    );

    // Fetches 51 to detect whether a next page exists (caller takes first 50)
    List<AiChatMessage> findTop51ByTripIdAndUserIdOrderByTimestampDesc(
        UUID tripId,
        UUID userId
    );

    List<AiChatMessage> findTop51ByTripIdAndUserIdAndTimestampBeforeOrderByTimestampDesc(
        UUID tripId,
        UUID userId,
        OffsetDateTime before
    );

    @Transactional
    @Modifying
    @Query("DELETE FROM AiChatMessage a WHERE a.trip.id = :tripId")
    void deleteAllByTripId(@Param("tripId") UUID tripId);

    @Transactional
    @Modifying
    @Query("DELETE FROM AiChatMessage a WHERE a.timestamp < :cutoff")
    void deleteByTimestampBefore(@Param("cutoff") OffsetDateTime cutoff);
}

package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.AiChatMessage;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiChatMessageRepository
    extends JpaRepository<AiChatMessage, UUID>
{
    List<AiChatMessage> findByTripIdAndUserIdOrderByTimestampAsc(
        UUID tripId,
        UUID userId
    );

    List<AiChatMessage> findTop5ByTripIdAndUserIdOrderByTimestampDesc(
        UUID tripId,
        UUID userId
    );
}

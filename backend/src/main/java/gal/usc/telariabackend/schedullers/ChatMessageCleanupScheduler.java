package gal.usc.telariabackend.schedullers;

import gal.usc.telariabackend.repository.AiChatMessageRepository;
import gal.usc.telariabackend.repository.TripChatMessageRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;

@Component
public class ChatMessageCleanupScheduler {

    private final AiChatMessageRepository aiChatMessageRepository;
    private final TripChatMessageRepository tripChatMessageRepository;

    public ChatMessageCleanupScheduler(AiChatMessageRepository aiChatMessageRepository,
                                       TripChatMessageRepository tripChatMessageRepository) {
        this.aiChatMessageRepository = aiChatMessageRepository;
        this.tripChatMessageRepository = tripChatMessageRepository;
    }

    @Scheduled(cron = "0 0 2 * * *")
    public void deleteOldMessages() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(30);
        aiChatMessageRepository.deleteByTimestampBefore(cutoff);
        tripChatMessageRepository.deleteByTimestampBefore(cutoff);
    }
}

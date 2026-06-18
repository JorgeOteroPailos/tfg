package gal.usc.telariabackend.schedullers;

import gal.usc.telariabackend.configuration.SchedulingProperties;
import gal.usc.telariabackend.repository.AiChatMessageRepository;
import gal.usc.telariabackend.repository.TripChatMessageRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;

@Component
public class ChatMessageCleanupScheduler {

    private final AiChatMessageRepository aiChatMessageRepository;
    private final TripChatMessageRepository tripChatMessageRepository;
    private final SchedulingProperties schedulingProperties;

    public ChatMessageCleanupScheduler(AiChatMessageRepository aiChatMessageRepository,
                                       TripChatMessageRepository tripChatMessageRepository,
                                       SchedulingProperties schedulingProperties) {
        this.aiChatMessageRepository = aiChatMessageRepository;
        this.tripChatMessageRepository = tripChatMessageRepository;
        this.schedulingProperties = schedulingProperties;
    }

    @Scheduled(cron = "${scheduling.chat-cleanup-cron}")
    public void deleteOldMessages() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(schedulingProperties.getChatRetentionDays());
        aiChatMessageRepository.deleteByTimestampBefore(cutoff);
        tripChatMessageRepository.deleteByTimestampBefore(cutoff);
    }
}

package gal.usc.telariabackend.schedullers;

import gal.usc.telariabackend.repository.AiChatMessageRepository;
import gal.usc.telariabackend.repository.TripChatMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatMessageCleanupSchedulerTest {

    @Mock
    private AiChatMessageRepository aiChatMessageRepository;

    @Mock
    private TripChatMessageRepository tripChatMessageRepository;

    private ChatMessageCleanupScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new ChatMessageCleanupScheduler(aiChatMessageRepository, tripChatMessageRepository);
    }

    @Test
    void deleteOldMessages_ShouldDeleteMessagesOlderThan30Days() {
        OffsetDateTime before = OffsetDateTime.now().minusDays(30);

        scheduler.deleteOldMessages();

        ArgumentCaptor<OffsetDateTime> aiCaptor = ArgumentCaptor.forClass(OffsetDateTime.class);
        ArgumentCaptor<OffsetDateTime> tripCaptor = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(aiChatMessageRepository).deleteByTimestampBefore(aiCaptor.capture());
        verify(tripChatMessageRepository).deleteByTimestampBefore(tripCaptor.capture());

        OffsetDateTime after = OffsetDateTime.now().minusDays(30);
        assertTrue(aiCaptor.getValue().isAfter(before) || aiCaptor.getValue().isEqual(before));
        assertTrue(aiCaptor.getValue().isBefore(after) || aiCaptor.getValue().isEqual(after));
        assertTrue(tripCaptor.getValue().isAfter(before) || tripCaptor.getValue().isEqual(before));
        assertTrue(tripCaptor.getValue().isBefore(after) || tripCaptor.getValue().isEqual(after));
    }

    @Test
    void deleteOldMessages_ShouldOnlyCallDeleteByTimestampBefore() {
        scheduler.deleteOldMessages();

        verify(aiChatMessageRepository).deleteByTimestampBefore(any(OffsetDateTime.class));
        verify(tripChatMessageRepository).deleteByTimestampBefore(any(OffsetDateTime.class));
        verifyNoMoreInteractions(aiChatMessageRepository, tripChatMessageRepository);
    }
}

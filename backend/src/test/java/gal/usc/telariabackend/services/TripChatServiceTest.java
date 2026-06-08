package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.TripChatMessage;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.TripChatMessageRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TripChatServiceTest {

    @Mock private TripRepository tripRepo;
    @Mock private UserRepository userRepo;
    @Mock private TripChatMessageRepository chatRepo;

    private TripChatService tripChatService;

    private UUID userId;
    private UUID tripId;
    private User user;
    private Trip trip;

    @BeforeEach
    void setUp() {
        tripChatService = new TripChatService(tripRepo, userRepo, chatRepo);
        userId = UUID.randomUUID();
        tripId = UUID.randomUUID();
        user = new User("alice", "alice@test.com", "encoded", userId);
        trip = mock(Trip.class);
    }

    // ── getHistory ─────────────────────────────────────────────────────────────

    @Test
    void getHistory_WhenUserIsMember_ShouldReturnMappedDtos() {
        TripChatMessage msg1 = mock(TripChatMessage.class);
        TripChatMessage msg2 = mock(TripChatMessage.class);
        var dto1 = mock(gal.usc.telariabackend.model.dto.TripChatMessage.class);
        var dto2 = mock(gal.usc.telariabackend.model.dto.TripChatMessage.class);

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(chatRepo.findByTripIdOrderByTimestampAsc(tripId)).thenReturn(List.of(msg1, msg2));
        when(msg1.toDto()).thenReturn(dto1);
        when(msg2.toDto()).thenReturn(dto2);

        var result = tripChatService.getHistory(tripId, userId);

        assertEquals(2, result.size());
        assertTrue(result.containsAll(List.of(dto1, dto2)));
    }

    @Test
    void getHistory_WhenChatIsEmpty_ShouldReturnEmptyList() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(chatRepo.findByTripIdOrderByTimestampAsc(tripId)).thenReturn(List.of());

        var result = tripChatService.getHistory(tripId, userId);

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void getHistory_WhenUserIsNotMember_ShouldThrowAndNotQueryMessages() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class, () -> tripChatService.getHistory(tripId, userId));

        verifyNoInteractions(chatRepo);
    }

    @Test
    void getHistory_ShouldQueryMessagesByTripId() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(chatRepo.findByTripIdOrderByTimestampAsc(tripId)).thenReturn(List.of());

        tripChatService.getHistory(tripId, userId);

        verify(chatRepo).findByTripIdOrderByTimestampAsc(tripId);
        verifyNoInteractions(userRepo);
    }

    // ── sendMessage ────────────────────────────────────────────────────────────

    @Test
    void sendMessage_WhenUserIsMember_ShouldSaveEntityWithCorrectContent() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));

        tripChatService.sendMessage(tripId, userId, "Hello trip!");

        ArgumentCaptor<TripChatMessage> captor = ArgumentCaptor.forClass(TripChatMessage.class);
        verify(chatRepo).save(captor.capture());
        assertEquals("Hello trip!", captor.getValue().getContent());
    }

    @Test
    void sendMessage_WhenUserIsMember_ShouldSaveEntityWithCorrectTripAndUser() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));

        tripChatService.sendMessage(tripId, userId, "Hola!");

        ArgumentCaptor<TripChatMessage> captor = ArgumentCaptor.forClass(TripChatMessage.class);
        verify(chatRepo).save(captor.capture());
        assertSame(trip, captor.getValue().getTrip());
        assertSame(user, captor.getValue().getUser());
    }

    @Test
    void sendMessage_WhenUserIsMember_ShouldReturnDtoWithSenderInfo() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));

        var result = tripChatService.sendMessage(tripId, userId, "Hola!");

        assertEquals(userId, result.getSenderId());
        assertEquals("alice", result.getSenderUsername());
        assertEquals("Hola!", result.getContent());
    }

    @Test
    void sendMessage_WhenUserIsMember_ShouldSetTimestamp() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));

        tripChatService.sendMessage(tripId, userId, "Check timestamp");

        ArgumentCaptor<TripChatMessage> captor = ArgumentCaptor.forClass(TripChatMessage.class);
        verify(chatRepo).save(captor.capture());
        assertNotNull(captor.getValue().getTimestamp());
    }

    @Test
    void sendMessage_WhenUserIsNotMember_ShouldThrowAndNotSave() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class,
                () -> tripChatService.sendMessage(tripId, userId, "Hello"));

        verifyNoInteractions(chatRepo);
        verifyNoInteractions(userRepo);
    }

    @Test
    void sendMessage_ShouldLookupUserBeforeSaving() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));

        tripChatService.sendMessage(tripId, userId, "Order matters");

        var inOrder = inOrder(userRepo, chatRepo);
        inOrder.verify(userRepo).findById(userId);
        inOrder.verify(chatRepo).save(any(TripChatMessage.class));
    }

    // ── subscribe ──────────────────────────────────────────────────────────────

    @Test
    void subscribe_WhenUserIsMember_ShouldReturnNonNullEmitter() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));

        SseEmitter emitter = tripChatService.subscribe(tripId, userId);

        assertNotNull(emitter);
    }

    @Test
    void subscribe_WhenUserIsNotMember_ShouldThrow() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class,
                () -> tripChatService.subscribe(tripId, userId));
    }

    @Test
    void subscribe_MultipleUsers_ShouldReturnDistinctEmitters() {
        UUID otherUserId = UUID.randomUUID();
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(tripRepo.findByIdAndMembersId(tripId, otherUserId)).thenReturn(Optional.of(trip));

        SseEmitter emitterA = tripChatService.subscribe(tripId, userId);
        SseEmitter emitterB = tripChatService.subscribe(tripId, otherUserId);

        assertNotSame(emitterA, emitterB);
    }

    @Test
    void subscribe_WhenEmitterCompletes_ShouldNotThrowOnSubsequentSend() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));

        // User subscribes then disconnects
        SseEmitter emitter = tripChatService.subscribe(tripId, userId);
        emitter.complete();

        // A second user sends a message — should not throw even though the first emitter is done
        UUID senderId = UUID.randomUUID();
        User sender = new User("bob", "bob@test.com", "encoded", senderId);
        when(tripRepo.findByIdAndMembersId(tripId, senderId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(senderId)).thenReturn(Optional.of(sender));

        assertDoesNotThrow(() -> tripChatService.sendMessage(tripId, senderId, "Anyone there?"));
    }
}

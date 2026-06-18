package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.AiChatMessage;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.AiChatMessageRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiChatServiceTest {

    @Mock private AiChatMessageRepository chatMessageRepo;
    @Mock private TripRepository tripRepo;
    @Mock private UserRepository userRepo;
    @Mock private PlatformTransactionManager txManager;
    @Mock private TransactionStatus txStatus;

    private AiChatService service;
    private UUID userId;
    private UUID tripId;
    private User user;
    private Trip trip;

    @BeforeEach
    void setUp() {
        when(txManager.getTransaction(any())).thenReturn(txStatus);
        service = new AiChatService(chatMessageRepo, tripRepo, userRepo, new ObjectMapper(), txManager);
        userId = UUID.randomUUID();
        tripId = UUID.randomUUID();
        user = new User("pepe", "pepe@test.com", "encoded", userId);
        trip = new Trip("Viaje a Roma", user);
    }

    // ── getHistory ──────────────────────────────────────────────────────────────

    @Test
    void getHistory_WhenUserIsMember_ShouldReturnMappedDtos() {
        AiChatMessage msg1 = mock(AiChatMessage.class);
        AiChatMessage msg2 = mock(AiChatMessage.class);
        var dto1 = mock(gal.usc.telariabackend.model.dto.AiChatMessage.class);
        var dto2 = mock(gal.usc.telariabackend.model.dto.AiChatMessage.class);

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(chatMessageRepo.findTop51ByTripIdAndUserIdOrderByTimestampDesc(tripId, userId))
                .thenReturn(List.of(msg1, msg2));
        when(msg1.toDto()).thenReturn(dto1);
        when(msg2.toDto()).thenReturn(dto2);
        when(msg1.getTimestamp()).thenReturn(OffsetDateTime.now().minusMinutes(2));
        when(msg2.getTimestamp()).thenReturn(OffsetDateTime.now().minusMinutes(1));

        var result = service.getHistory(tripId, userId, null);

        assertNotNull(result);
        assertEquals(2, result.getMessages().size());
        assertTrue(result.getMessages().containsAll(List.of(dto1, dto2)));
        assertFalse(result.getHasMore());
    }

    @Test
    void getHistory_WhenChatIsEmpty_ShouldReturnEmptyList() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(chatMessageRepo.findTop51ByTripIdAndUserIdOrderByTimestampDesc(tripId, userId))
                .thenReturn(List.of());

        var result = service.getHistory(tripId, userId, null);

        assertNotNull(result);
        assertTrue(result.getMessages().isEmpty());
        assertFalse(result.getHasMore());
    }

    @Test
    void getHistory_WhenUserIsNotMember_ShouldThrowAndNotQueryMessages() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class, () -> service.getHistory(tripId, userId, null));

        verifyNoInteractions(chatMessageRepo);
    }

    // ── streamResponse ──────────────────────────────────────────────────────────

    @Test
    void streamResponse_WhenUserIsNotMember_ShouldThrow() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class,
                () -> service.streamResponse(tripId, userId, "Hello", mock(SseEmitter.class)));
    }

    @Test
    void streamResponse_WhenUserIsNotMember_ShouldNotSaveAnyMessages() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class,
                () -> service.streamResponse(tripId, userId, "Hello", mock(SseEmitter.class)));

        verifyNoInteractions(chatMessageRepo);
        verifyNoInteractions(userRepo);
    }

    @Test
    void streamResponse_WhenStreamFails_ShouldStillPersistUserMessageButNotAssistant() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(chatMessageRepo.findTop5ByTripIdAndUserIdOrderByTimestampDesc(tripId, userId))
                .thenReturn(List.of());
        when(tripRepo.findById(tripId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));

        AiChatService spy = spy(service);
        doThrow(new RuntimeException("ollama unreachable"))
                .when(spy).callOllamaStream(any(), any(), any(), any());
        SseEmitter emitter = mock(SseEmitter.class);

        spy.streamResponse(tripId, userId, "Hola", emitter);

        // The user message must survive even though the model never replied,
        // and no (empty) assistant row should be stored.
        ArgumentCaptor<AiChatMessage> captor = ArgumentCaptor.forClass(AiChatMessage.class);
        verify(chatMessageRepo, times(1)).save(captor.capture());
        AiChatMessage saved = captor.getValue();
        assertEquals(AiChatMessage.Role.USER, saved.getRole());
        assertEquals("Hola", saved.getContent());
        verify(emitter).completeWithError(any());
    }

    @Test
    void streamResponse_OnSuccess_ShouldOrderAssistantStrictlyAfterUser() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(chatMessageRepo.findTop5ByTripIdAndUserIdOrderByTimestampDesc(tripId, userId))
                .thenReturn(List.of());
        when(tripRepo.findById(tripId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));

        AiChatService spy = spy(service);
        doAnswer(inv -> {
            java.util.function.Consumer<String> onChunk = inv.getArgument(3);
            onChunk.accept("Hola, ");
            onChunk.accept("¿qué tal?");
            return null;
        }).when(spy).callOllamaStream(any(), any(), any(), any());
        SseEmitter emitter = mock(SseEmitter.class);

        spy.streamResponse(tripId, userId, "Hola", emitter);

        ArgumentCaptor<AiChatMessage> captor = ArgumentCaptor.forClass(AiChatMessage.class);
        verify(chatMessageRepo, times(2)).save(captor.capture());
        AiChatMessage userMsg = captor.getAllValues().get(0);
        AiChatMessage assistantMsg = captor.getAllValues().get(1);

        assertEquals(AiChatMessage.Role.USER, userMsg.getRole());
        assertEquals(AiChatMessage.Role.ASSISTANT, assistantMsg.getRole());
        assertEquals("Hola, ¿qué tal?", assistantMsg.getContent());
        assertTrue(assistantMsg.getTimestamp().isAfter(userMsg.getTimestamp()),
                "assistant timestamp must sort strictly after the user message");
        verify(emitter).complete();
    }
}

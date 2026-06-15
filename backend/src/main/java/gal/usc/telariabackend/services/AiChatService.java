package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.AiChatMessage;
import gal.usc.telariabackend.model.Location;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.AiChatMessageRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class AiChatService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final AiChatMessageRepository chatMessageRepo;
    private final TripRepository tripRepo;
    private final UserRepository userRepo;
    private final TransactionTemplate txReadOnly;
    private final TransactionTemplate txWrite;

    @Value("${ollama.base-url:http://localhost:11434}")
    private String ollamaBaseUrl;

    @Value("${ollama.model:llama3.2:3b}")
    private String ollamaModel;

    private RestClient restClient;
    private final ObjectMapper objectMapper;

    public AiChatService(
        AiChatMessageRepository chatMessageRepo,
        TripRepository tripRepo,
        UserRepository userRepo,
        ObjectMapper objectMapper,
        PlatformTransactionManager txManager
    ) {
        this.chatMessageRepo = chatMessageRepo;
        this.tripRepo = tripRepo;
        this.userRepo = userRepo;
        this.objectMapper = objectMapper;
        this.txReadOnly = new TransactionTemplate(txManager);
        this.txReadOnly.setReadOnly(true);
        this.txWrite = new TransactionTemplate(txManager);
    }

    @PostConstruct
    private void init() {
        this.restClient = RestClient.builder().baseUrl(ollamaBaseUrl).build();
    }

    public gal.usc.telariabackend.model.dto.AiChatHistoryPage getHistory(
        UUID tripId,
        UUID userId,
        OffsetDateTime before
    ) {
        return txReadOnly.execute(status -> {
            tripRepo.findByIdAndMembersId(tripId, userId).orElseThrow(NotATripMemberException::new);

            List<AiChatMessage> rows = before == null
                ? chatMessageRepo.findTop51ByTripIdAndUserIdOrderByTimestampDesc(tripId, userId)
                : chatMessageRepo.findTop51ByTripIdAndUserIdAndTimestampBeforeOrderByTimestampDesc(tripId, userId, before);

            boolean hasMore = rows.size() == 51;
            List<gal.usc.telariabackend.model.dto.AiChatMessage> messages = rows.stream()
                .limit(50)
                .sorted((a, b) -> a.getTimestamp().compareTo(b.getTimestamp()))
                .map(AiChatMessage::toDto)
                .toList();

            return new gal.usc.telariabackend.model.dto.AiChatHistoryPage()
                .messages(messages)
                .hasMore(hasMore);
        });
    }

    // Not @Transactional — transaction is split manually so the DB connection
    // is NOT held open for the duration of the Ollama HTTP call.
    public void streamResponse(
        UUID tripId,
        UUID userId,
        String userMessage,
        SseEmitter emitter
    ) {
        // Phase 1: permission check + context fetch (short read-only transaction)
        record Context(String systemPrompt, List<AiChatMessage> history) {}
        Context ctx = txReadOnly.execute(status -> {
            Trip trip = tripRepo
                .findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new);
            List<AiChatMessage> history = chatMessageRepo
                .findTop5ByTripIdAndUserIdOrderByTimestampDesc(tripId, userId)
                .reversed();
            return new Context(buildSystemPrompt(trip), history);
        });

        // Phase 2: stream from Ollama (no DB connection held)
        StringBuilder fullResponse = new StringBuilder();
        boolean[] emitterAlive = {true};

        try {
            callOllamaStream(ctx.systemPrompt(), ctx.history(), userMessage, chunk -> {
                fullResponse.append(chunk);
                if (emitterAlive[0]) {
                    try {
                        emitter.send(SseEmitter.event().data(chunk));
                    } catch (IOException e) {
                        // Client disconnected — stop sending but keep accumulating
                        // so the full response is still persisted in phase 3.
                        emitterAlive[0] = false;
                    }
                }
            });
        } catch (Exception e) {
            if (emitterAlive[0]) emitter.completeWithError(e);
            return;
        }

        // Phase 3: persist both messages (short write transaction, always runs)
        txWrite.execute(status -> {
            Trip trip = tripRepo.findById(tripId).orElseThrow();
            User user = userRepo.findById(userId).orElseThrow();
            chatMessageRepo.save(new AiChatMessage(trip, user, AiChatMessage.Role.USER, userMessage));
            chatMessageRepo.save(new AiChatMessage(trip, user, AiChatMessage.Role.ASSISTANT, fullResponse.toString()));
            return null;
        });

        if (emitterAlive[0]) emitter.complete();
    }

    private String buildSystemPrompt(Trip trip) {
        StringBuilder sb = new StringBuilder();
        sb.append("Eres un asistente experto en viajes. ");
        sb.append("Hoy es ").append(LocalDate.now().format(DATE_FMT)).append(".\n");
        sb.append("El usuario está en un viaje llamado \"")
            .append(trip.getName())
            .append("\".\n\n");

        sb.append("EVENTOS:\n");
        trip.getEvents().forEach(e -> {
            sb.append("- ").append(e.getName());
            if (e.getStartTime() != null) {
                sb.append(" (").append(e.getStartTime().format(DATETIME_FMT)).append(")");
            }
            Location loc = e.getLocation();
            if (loc != null && loc.getName() != null) {
                sb.append(" en ").append(loc.getName());
            }
            sb.append("\n");
        });

        sb.append("\nGASTOS:\n");
        trip.getExpenses().forEach(e -> {
            sb.append("- ")
                .append(e.getName())
                .append(" [").append(e.getCategory()).append("]")
                .append(": ")
                .append(e.getAmount())
                .append("€")
                .append(" (pagado por ").append(e.getPayer().getUsername());
            if (e.getTimestamp() != null) {
                sb.append(", el ").append(e.getTimestamp().format(DATE_FMT));
            }
            sb.append(")\n");
        });

        sb.append("\nResponde en el idioma en que te escriba el usuario.");
        return sb.toString();
    }

    private void callOllamaStream(
        String systemPrompt,
        List<AiChatMessage> history,
        String userMessage,
        Consumer<String> onChunk
    ) {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));

        history.forEach(m ->
            messages.add(
                Map.of(
                    "role",
                    m.getRole() == AiChatMessage.Role.USER
                        ? "user"
                        : "assistant",
                    "content",
                    m.getContent()
                )
            )
        );

        messages.add(Map.of("role", "user", "content", userMessage));

        Map<String, Object> body = Map.of(
            "model",
            ollamaModel,
            "messages",
            messages,
            "stream",
            true
        );

        restClient
            .post()
            .uri("/api/chat")
            .contentType(MediaType.APPLICATION_JSON)
            .body(body)
            .exchange((_, res) -> {
                try (
                    BufferedReader reader = new BufferedReader(
                        new InputStreamReader(res.getBody())
                    )
                ) {
                    String line;
                    while (
                        (line = reader.readLine()) != null && !line.isBlank()
                    ) {
                        JsonNode node = objectMapper.readTree(line);
                        String chunk = node
                            .path("message")
                            .path("content")
                            .asString();
                        if (!chunk.isEmpty()) onChunk.accept(chunk);
                    }
                }
                return null;
            });
    }
}

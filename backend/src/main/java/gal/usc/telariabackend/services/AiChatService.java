package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.AiChatMessage;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.AiChatMessageRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

@Service
public class AiChatService {
    private final AiChatMessageRepository chatMessageRepo;
    private final TripRepository tripRepo;
    private final UserRepository userRepo;

    @Value("${ollama.base-url:http://localhost:11434}")
    private String ollamaBaseUrl;

    @Value("${ollama.model:llama3.2:3b}")
    private String ollamaModel;

    private RestClient restClient;
    private final ObjectMapper objectMapper;


    public AiChatService(AiChatMessageRepository chatMessageRepo,
                         TripRepository tripRepo,
                         UserRepository userRepo,
                         ObjectMapper objectMapper) {
        this.chatMessageRepo = chatMessageRepo;
        this.tripRepo = tripRepo;
        this.userRepo = userRepo;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    private void init() {
        this.restClient = RestClient.builder()
                .baseUrl(ollamaBaseUrl)
                .build();
    }

    public List<gal.usc.telariabackend.model.dto.AiChatMessage> getHistory(UUID tripId, UUID userId) {
        tripRepo.findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new);
        return chatMessageRepo.findByTripIdAndUserIdOrderByTimestampAsc(tripId, userId)
                .stream()
                .map(AiChatMessage::toDto)
                .toList();
    }

    @Transactional
    public void streamResponse(UUID tripId, UUID userId, String userMessage, SseEmitter emitter) {
        Trip trip = tripRepo.findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new);
        User user = userRepo.findById(userId).orElseThrow();

        List<AiChatMessage> history = chatMessageRepo
                .findTop10ByTripIdAndUserIdOrderByTimestampDesc(tripId, userId)
                .reversed();

        String systemPrompt = buildSystemPrompt(trip);

        StringBuilder fullResponse = new StringBuilder();

        try {
            callOllamaStream(systemPrompt, history, userMessage, chunk -> {
                fullResponse.append(chunk);
                try {
                    emitter.send(SseEmitter.event().data(chunk));
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            });

            chatMessageRepo.save(new AiChatMessage(trip, user, AiChatMessage.Role.USER, userMessage));
            chatMessageRepo.save(new AiChatMessage(trip, user, AiChatMessage.Role.ASSISTANT, fullResponse.toString()));
            emitter.complete();

        } catch (Exception e) {
            emitter.completeWithError(e);
        }
    }

    private String buildSystemPrompt(Trip trip) {
        StringBuilder sb = new StringBuilder();
        sb.append("Eres un asistente experto en viajes. ");
        sb.append("El usuario está en un viaje llamado \"").append(trip.getName()).append("\".\n\n");

        sb.append("EVENTOS:\n");
        trip.getEvents().forEach(e -> sb.append("- ").append(e.getName())
                .append(" (").append(e.getStartTime()).append(")")
                .append(" en ").append(e.getLocation().getName()).append("\n"));

        sb.append("\nGASTOS:\n");
        trip.getExpenses().forEach(e -> sb.append("- ").append(e.getName())
                .append(": ").append(e.getAmount()).append("€")
                .append(" (pagado por ").append(e.getPayer().getUsername()).append(")\n"));

        sb.append("\nResponde en el idioma en que te escriba el usuario.");
        return sb.toString();
    }

    private void callOllamaStream(String systemPrompt, List<AiChatMessage> history,
                                  String userMessage, Consumer<String> onChunk) {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));

        history.forEach(m -> messages.add(Map.of(
                "role", m.getRole() == AiChatMessage.Role.USER ? "user" : "assistant",
                "content", m.getContent()
        )));

        messages.add(Map.of("role", "user", "content", userMessage));

        Map<String, Object> body = Map.of(
                "model", ollamaModel,
                "messages", messages,
                "stream", true
        );

        restClient.post()
                .uri("/api/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .exchange((_, res) -> {
                    try (BufferedReader reader = new BufferedReader(
                            new InputStreamReader(res.getBody()))) {
                        String line;
                        while ((line = reader.readLine()) != null && !line.isBlank()) {
                            JsonNode node = objectMapper.readTree(line);
                            String chunk = node.path("message").path("content").asString();
                            if (!chunk.isEmpty()) onChunk.accept(chunk);
                        }
                    }
                    return null;
                });
    }
}

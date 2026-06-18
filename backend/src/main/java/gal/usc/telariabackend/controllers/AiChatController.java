package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.dto.AiChatHistoryPage;
import gal.usc.telariabackend.model.dto.AiChatMessageRequest;
import gal.usc.telariabackend.services.AiChatService;
import gal.usc.telariabackend.utils.SecurityHelper;
import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class AiChatController implements AiChatApi {
    private final AiChatService aiChatService;
    private final SecurityHelper securityHelper;
    // Virtual threads: lightweight, bounded only by memory, no pool tuning needed.
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    // Sourced from the MVC async request timeout so the SseEmitter and the servlet
    // async timeout never disagree (a shorter async timeout would otherwise cut the
    // stream before the emitter's own deadline).
    @Value("${spring.mvc.async.request-timeout:120000}")
    private long asyncRequestTimeoutMs;

    public AiChatController(AiChatService aiChatService, SecurityHelper securityHelper) {
        this.aiChatService = aiChatService;
        this.securityHelper = securityHelper;
    }

    @Override
    public ResponseEntity<AiChatHistoryPage> getAiChatHistory(
        UUID tripId,
        @RequestParam(value = "before", required = false) OffsetDateTime before
    ) {
        return new ResponseEntity<>(
            aiChatService.getHistory(tripId, securityHelper.getUserId(), before),
            HttpStatus.OK
        );
    }

    /**
     * Streams an AI assistant response for the given trip as Server-Sent Events.
     * The assistant has context of the trip's events and expenses.
     * Message history (last 5 messages) is included in each request to Ollama.
     * The user message and assistant response are persisted after the stream completes.
     *
     * @param tripId  the trip to chat about
     * @param request the user's message
     * @return an {@link SseEmitter} that streams the assistant response token by token
     */
    @PostMapping(value = "/trips/{tripId}/ai-chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter sendAiChatMessage(@PathVariable UUID tripId, @Valid @RequestBody AiChatMessageRequest request) {
        UUID userId = securityHelper.getUserId();
        // Aligned with spring.mvc.async.request-timeout so a long AI response is cut by a
        // single, predictable deadline. On timeout, complete cleanly rather than erroring.
        SseEmitter emitter = new SseEmitter(asyncRequestTimeoutMs);
        emitter.onTimeout(emitter::complete);

        executor.execute(() -> {
            try {
                aiChatService.streamResponse(tripId, userId, request.getContent(), emitter);
            } catch (Exception e) {
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }
}

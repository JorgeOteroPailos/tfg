package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.dto.AiChatMessage;
import gal.usc.telariabackend.model.dto.AiChatMessageRequest;
import gal.usc.telariabackend.services.AiChatService;
import gal.usc.telariabackend.utils.SecurityHelper;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
public class AiChatController implements AiChatApi {
    private final AiChatService aiChatService;
    private final SecurityHelper securityHelper;

    public AiChatController(AiChatService aiChatService, SecurityHelper securityHelper) {
        this.aiChatService = aiChatService;
        this.securityHelper = securityHelper;
    }

    @Override
    public ResponseEntity<List<AiChatMessage>> getAiChatHistory(UUID tripId) {
        return new ResponseEntity<>(aiChatService.getHistory(tripId, securityHelper.getUserId()), HttpStatus.OK);
    }

    @PostMapping(value = "/trips/{tripId}/ai-chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter sendAiChatMessage(@PathVariable UUID tripId, @RequestBody AiChatMessageRequest request) {
        UUID userId = securityHelper.getUserId();
        SseEmitter emitter = new SseEmitter();

        ExecutorService executor = Executors.newSingleThreadExecutor();
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

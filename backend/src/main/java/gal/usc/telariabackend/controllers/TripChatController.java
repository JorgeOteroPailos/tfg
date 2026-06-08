package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.dto.SendTripChatMessageRequest;
import gal.usc.telariabackend.model.dto.TripChatMessage;
import gal.usc.telariabackend.services.TripChatService;
import gal.usc.telariabackend.utils.SecurityHelper;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.UUID;

@RestController
public class TripChatController implements GroupChatApi {

    private final TripChatService tripChatService;
    private final SecurityHelper securityHelper;

    public TripChatController(TripChatService tripChatService, SecurityHelper securityHelper) {
        this.tripChatService = tripChatService;
        this.securityHelper = securityHelper;
    }

    @Override
    public ResponseEntity<List<TripChatMessage>> getGroupChatHistory(UUID tripId) {
        return new ResponseEntity<>(
                tripChatService.getHistory(tripId, securityHelper.getUserId()),
                HttpStatus.OK
        );
    }

    @Override
    public ResponseEntity<TripChatMessage> sendGroupChatMessage(UUID tripId, SendTripChatMessageRequest sendTripChatMessageRequest) {
        return new ResponseEntity<>(
                tripChatService.sendMessage(tripId, securityHelper.getUserId(), sendTripChatMessageRequest.getContent()),
                HttpStatus.CREATED
        );
    }

    @GetMapping(value = "/trips/{tripId}/group-chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamGroupChat(@PathVariable UUID tripId) {
        return tripChatService.subscribe(tripId, securityHelper.getUserId());
    }
}

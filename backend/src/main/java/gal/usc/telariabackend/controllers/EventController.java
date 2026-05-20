package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.dto.CreateEventRequest;
import gal.usc.telariabackend.model.dto.EventSummary;
import gal.usc.telariabackend.model.dto.IdResponse;
import gal.usc.telariabackend.services.EventService;
import gal.usc.telariabackend.utils.SecurityHelper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class EventController implements EventsApi {
    private final EventService eventService;
    private final SecurityHelper securityHelper;

    public EventController(EventService eventService, SecurityHelper securityHelper) {
        this.eventService = eventService;
        this.securityHelper = securityHelper;
    }

    @Override
    public ResponseEntity<IdResponse> createEvent(UUID tripId, CreateEventRequest createEventRequest) {
        IdResponse response = new IdResponse().id(eventService.createEvent(tripId, securityHelper.getUserId(), createEventRequest));
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @Override
    public ResponseEntity<Void> deleteEvent(UUID tripId, UUID eventId) {
        eventService.deleteEvent(tripId, eventId, securityHelper.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    @Override
    public ResponseEntity<List<EventSummary>> listEvents(UUID tripId) {
        return new ResponseEntity<>(eventService.listEvents(tripId, securityHelper.getUserId()), HttpStatus.OK);
    }
}

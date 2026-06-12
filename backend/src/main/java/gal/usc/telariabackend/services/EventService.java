package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.Event;
import gal.usc.telariabackend.model.Location;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.dto.CreateEventRequest;
import gal.usc.telariabackend.model.dto.EventSummary;
import gal.usc.telariabackend.model.exceptions.EventNotFoundException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.EventRepository;
import gal.usc.telariabackend.repository.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class EventService {
    private final TripRepository tripRepo;
    private final EventRepository eventRepo;

    public EventService(TripRepository tripRepo, EventRepository eventRepo) {
        this.tripRepo = tripRepo;
        this.eventRepo = eventRepo;
    }

    @Transactional
    public UUID createEvent(UUID tripId, UUID userId, CreateEventRequest request) {
        Trip trip = tripRepo.findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new);

        Location location = null;
        if (request.getLocation() != null) {
            var loc = request.getLocation();
            location = new Location(loc.getName(), loc.getAddress(), loc.getLatitude(), loc.getLongitude(), loc.getMapURL());
        }

        Event event = new Event(
                trip,
                request.getName(),
                request.getStartTime() != null ? request.getStartTime().toZonedDateTime() : ZonedDateTime.now(),
                request.getDuration(),
                location
        );
        eventRepo.save(event);
        return event.getId();
    }

    @Transactional
    public void deleteEvent(UUID tripId, UUID eventId, UUID userId) {
        tripRepo.findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new);
        Event event = eventRepo.findById(eventId)
                .orElseThrow(EventNotFoundException::new);
        if (!event.getTrip().getId().equals(tripId)) {
            throw new NotATripMemberException();
        }
        eventRepo.deleteById(eventId);
    }

    public List<EventSummary> listEvents(UUID tripId, UUID userId) {
        Trip trip = tripRepo.findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new);
        return trip.getEvents().stream().map(Event::toEventSummary).toList();
    }
}

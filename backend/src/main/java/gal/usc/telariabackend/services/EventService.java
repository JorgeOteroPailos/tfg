package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.Event;
import gal.usc.telariabackend.model.Location;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.dto.CreateEventRequest;
import gal.usc.telariabackend.model.dto.EventSummary;
import gal.usc.telariabackend.model.exceptions.EventNotFoundException;
import gal.usc.telariabackend.model.exceptions.InvalidLocationException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.EventRepository;
import gal.usc.telariabackend.repository.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
            if ((loc.getLatitude() == null) != (loc.getLongitude() == null)) {
                throw new InvalidLocationException("Latitude and longitude must be provided together");
            }
            if (loc.getLatitude() != null) {
                if (loc.getLatitude() < -90 || loc.getLatitude() > 90) {
                    throw new InvalidLocationException("Latitude must be between -90 and 90");
                }
                if (loc.getLongitude() < -180 || loc.getLongitude() > 180) {
                    throw new InvalidLocationException("Longitude must be between -180 and 180");
                }
            }
            location = new Location(loc.getName(), loc.getAddress(), loc.getLatitude(), loc.getLongitude());
        }

        Event event = new Event(
                trip,
                request.getName(),
                request.getStartTime().toZonedDateTime(),
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
            throw new EventNotFoundException();
        }
        eventRepo.delete(event);
    }

    public List<EventSummary> listEvents(UUID tripId, UUID userId) {
        tripRepo.findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new);
        return eventRepo.findByTripIdOrderByStartTimeAsc(tripId).stream()
                .map(Event::toEventSummary)
                .toList();
    }
}

package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.Event;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.CreateEventRequest;
import gal.usc.telariabackend.model.dto.EventSummary;
import gal.usc.telariabackend.model.exceptions.EventNotFoundException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.EventRepository;
import gal.usc.telariabackend.repository.TripRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EventServiceTest {

    @Mock
    private TripRepository tripRepo;
    @Mock
    private EventRepository eventRepo;

    private EventService eventService;

    private UUID userId;
    private UUID tripId;
    private User user;

    @BeforeEach
    void setUp() {
        eventService = new EventService(tripRepo, eventRepo);
        userId = UUID.randomUUID();
        tripId = UUID.randomUUID();
        user = new User("pepe", "pepe@example.com", "encoded", userId);
    }

    // createEvent

    @Test
    void createEvent_WhenMember_ShouldSaveEventWithCorrectData() {
        Trip trip = new Trip("Viaje a Roma", user);
        CreateEventRequest request = new CreateEventRequest().name("Cena en trattoria");

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));

        eventService.createEvent(tripId, userId, request);

        ArgumentCaptor<Event> captor = ArgumentCaptor.forClass(Event.class);
        verify(eventRepo).save(captor.capture());
        assertEquals("Cena en trattoria", captor.getValue().getName());
        assertEquals(trip, captor.getValue().getTrip());
    }

    @Test
    void createEvent_WhenMemberWithAllFields_ShouldSaveEventWithAllData() {
        Trip trip = new Trip("Viaje a Roma", user);
        OffsetDateTime startTime = OffsetDateTime.now();
        gal.usc.telariabackend.model.dto.Location locationDto =
                new gal.usc.telariabackend.model.dto.Location()
                        .name("Restaurante Casa Pepe")
                        .address("Calle Mayor 1")
                        .latitude(42.87)
                        .longitude(-8.54);

        CreateEventRequest request = new CreateEventRequest()
                .name("Cena")
                .startTime(startTime)
                .duration(120)
                .location(locationDto);

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));

        eventService.createEvent(tripId, userId, request);

        ArgumentCaptor<Event> captor = ArgumentCaptor.forClass(Event.class);
        verify(eventRepo).save(captor.capture());
        Event saved = captor.getValue();
        assertEquals("Cena", saved.getName());
        assertEquals(120, saved.getDuration());
        assertNotNull(saved.getStartTime());
        assertNotNull(saved.getLocation());
        assertEquals("Restaurante Casa Pepe", saved.getLocation().getName());
    }

    @Test
    void createEvent_WhenNotMember_ShouldThrowAndNotSave() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class,
                () -> eventService.createEvent(tripId, userId, new CreateEventRequest().name("Cena")));

        verifyNoInteractions(eventRepo);
    }

    // deleteEvent

    @Test
    void deleteEvent_WhenMemberAndEventBelongsToTrip_ShouldDelete() {
        Trip trip = mock(Trip.class);
        Event event = mock(Event.class);
        UUID eventId = UUID.randomUUID();

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(eventRepo.findById(eventId)).thenReturn(Optional.of(event));
        when(event.getTrip()).thenReturn(trip);
        when(trip.getId()).thenReturn(tripId);

        eventService.deleteEvent(tripId, eventId, userId);

        verify(eventRepo).deleteById(eventId);
    }

    @Test
    void deleteEvent_WhenNotMember_ShouldThrowAndNotDelete() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class,
                () -> eventService.deleteEvent(tripId, UUID.randomUUID(), userId));

        verify(eventRepo, never()).deleteById(any());
    }

    @Test
    void deleteEvent_WhenEventDoesNotExist_ShouldThrowAndNotDelete() {
        UUID eventId = UUID.randomUUID();
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(mock(Trip.class)));
        when(eventRepo.findById(eventId)).thenReturn(Optional.empty());

        assertThrows(EventNotFoundException.class,
                () -> eventService.deleteEvent(tripId, eventId, userId));

        verify(eventRepo, never()).deleteById(any());
    }

    @Test
    void deleteEvent_WhenEventBelongsToAnotherTrip_ShouldThrowAndNotDelete() {
        UUID eventId = UUID.randomUUID();
        Trip trip = mock(Trip.class);
        Trip otherTrip = mock(Trip.class);
        Event event = mock(Event.class);

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(eventRepo.findById(eventId)).thenReturn(Optional.of(event));
        when(event.getTrip()).thenReturn(otherTrip);
        when(otherTrip.getId()).thenReturn(UUID.randomUUID());

        assertThrows(NotATripMemberException.class,
                () -> eventService.deleteEvent(tripId, eventId, userId));

        verify(eventRepo, never()).deleteById(any());
    }

    // listEvents

    @Test
    void listEvents_WhenMember_ShouldReturnEventSummaries() {
        Trip trip = mock(Trip.class);
        Event e1 = mock(Event.class);
        Event e2 = mock(Event.class);
        EventSummary s1 = mock(EventSummary.class);
        EventSummary s2 = mock(EventSummary.class);

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getEvents()).thenReturn(List.of(e1, e2));
        when(e1.toEventSummary()).thenReturn(s1);
        when(e2.toEventSummary()).thenReturn(s2);

        List<EventSummary> result = eventService.listEvents(tripId, userId);

        assertEquals(2, result.size());
        assertTrue(result.containsAll(List.of(s1, s2)));
    }

    @Test
    void listEvents_WhenNoEvents_ShouldReturnEmptyList() {
        Trip trip = mock(Trip.class);
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getEvents()).thenReturn(List.of());

        List<EventSummary> result = eventService.listEvents(tripId, userId);

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void listEvents_WhenNotMember_ShouldThrow() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class,
                () -> eventService.listEvents(tripId, userId));
    }
}

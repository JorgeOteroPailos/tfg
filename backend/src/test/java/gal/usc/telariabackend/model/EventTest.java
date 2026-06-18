package gal.usc.telariabackend.model;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class EventTest {

    private Trip trip;

    @BeforeEach
    void setUp() {
        User owner = new User("pepe", "pepe@example.com", "encoded", UUID.randomUUID());
        trip = new Trip("Viaje de prueba", owner);
    }

    // Constructor

    @Test
    void constructor_WhenDurationIsNull_ShouldDefaultToZero() {
        Event event = new Event(trip, "Sin duración", ZonedDateTime.now(), null, null);

        assertEquals(0, event.getDuration());
    }

    @Test
    void constructor_WhenLocationIsNull_ShouldDefaultToEmptyLocation() {
        Event event = new Event(trip, "Sin lugar", ZonedDateTime.now(), 60, null);

        assertNotNull(event.getLocation());
    }

    @Test
    void constructor_ShouldSetAllFields() {
        ZonedDateTime start = ZonedDateTime.of(2025, 6, 15, 10, 0, 0, 0, ZoneOffset.UTC);
        Location location = new Location("Hotel", "Calle Mayor 1", 40.0, -3.0);

        Event event = new Event(trip, "Cena", start, 90, location);

        assertEquals("Cena", event.getName());
        assertEquals(start, event.getStartTime());
        assertEquals(90, event.getDuration());
        assertSame(location, event.getLocation());
    }

    // toEventSummary

    @Test
    void toEventSummary_WhenStartTimeIsNull_ShouldReturnNullStartTime() {
        Event event = new Event(trip, "Sin hora", null, 60, null);

        assertNull(event.toEventSummary().getStartTime());
    }

    @Test
    void toEventSummary_ShouldConvertStartTimeToOffsetDateTime() {
        ZonedDateTime start = ZonedDateTime.of(2025, 6, 15, 10, 0, 0, 0, ZoneOffset.ofHours(2));
        Event event = new Event(trip, "Evento", start, 60, null);

        assertEquals(start.toOffsetDateTime(), event.toEventSummary().getStartTime());
    }

    @Test
    void toEventSummary_ShouldMapLocationFields() {
        Location location = new Location("Hotel", "Calle Mayor 1", 40.0, -3.0);
        Event event = new Event(trip, "Evento", ZonedDateTime.now(), 60, location);

        var loc = event.toEventSummary().getLocation();

        assertNotNull(loc);
        assertEquals("Hotel", loc.getName());
        assertEquals("Calle Mayor 1", loc.getAddress());
        assertEquals(40.0, loc.getLatitude());
        assertEquals(-3.0, loc.getLongitude());
    }

    @Test
    void toEventSummary_WhenLocationEmpty_ShouldReturnNullLocation() {
        Event event = new Event(trip, "Sin lugar", ZonedDateTime.now(), 60, null);

        assertNull(event.toEventSummary().getLocation());
    }

    @Test
    void toEventSummary_ShouldMapNameAndDuration() {
        Event event = new Event(trip, "Excursión", ZonedDateTime.now(), 120, null);

        var summary = event.toEventSummary();

        assertEquals("Excursión", summary.getName());
        assertEquals(120, summary.getDuration());
    }
}

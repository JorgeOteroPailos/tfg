package gal.usc.telariabackend.model;

import gal.usc.telariabackend.model.exceptions.AlreadyDoneException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class TripTest {

    private User owner;
    private Trip trip;

    @BeforeEach
    void setUp() {
        owner = new User("pepe", "pepe@example.com", "encoded", UUID.randomUUID());
        trip = new Trip("Viaje a Roma", owner);
    }

    // Constructor

    @Test
    void constructor_ShouldAddOwnerAsInitialMember() {
        assertTrue(trip.getMembers().contains(owner));
    }

    @Test
    void constructor_ShouldSetTripName() {
        assertEquals("Viaje a Roma", trip.getName());
    }

    // assertIsMember(User)

    @Test
    void assertIsMember_WhenUserIsMember_ShouldNotThrow() {
        assertDoesNotThrow(() -> trip.assertIsMember(owner));
    }

    @Test
    void assertIsMember_WhenUserIsNotMember_ShouldThrowNotATripMemberException() {
        User stranger = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());

        assertThrows(NotATripMemberException.class, () -> trip.assertIsMember(stranger));
    }

    // assertIsMember(UUID)

    @Test
    void assertIsMember_ByUUID_WhenUserIsMember_ShouldNotThrow() {
        assertDoesNotThrow(() -> trip.assertIsMember(owner.getId()));
    }

    @Test
    void assertIsMember_ByUUID_WhenUserIsNotMember_ShouldThrowNotATripMemberException() {
        assertThrows(NotATripMemberException.class, () -> trip.assertIsMember(UUID.randomUUID()));
    }

    // assertIsNotMember(User)

    @Test
    void assertIsNotMember_WhenUserIsNotMember_ShouldNotThrow() {
        User stranger = new User("lola", "lola@test.com", "encoded", UUID.randomUUID());

        assertDoesNotThrow(() -> trip.assertIsNotMember(stranger));
    }

    @Test
    void assertIsNotMember_WhenUserIsMember_ShouldThrowAlreadyDoneException() {
        assertThrows(AlreadyDoneException.class, () -> trip.assertIsNotMember(owner));
    }

    // assertIsNotMember(UUID)

    @Test
    void assertIsNotMember_ByUUID_WhenUserIsNotMember_ShouldNotThrow() {
        assertDoesNotThrow(() -> trip.assertIsNotMember(UUID.randomUUID()));
    }

    @Test
    void assertIsNotMember_ByUUID_WhenUserIsMember_ShouldThrowAlreadyDoneException() {
        assertThrows(AlreadyDoneException.class, () -> trip.assertIsNotMember(owner.getId()));
    }

    // toTripSummary

    @Test
    void toTripSummary_ShouldReturnSummaryWithCorrectNameAndId() {
        var summary = trip.toTripSummary();

        assertEquals("Viaje a Roma", summary.getName());
    }

    // equals y hashCode

    @Test
    void equals_TripShouldNotEqualNull() {
        assertNotEquals(null, trip);
    }
}
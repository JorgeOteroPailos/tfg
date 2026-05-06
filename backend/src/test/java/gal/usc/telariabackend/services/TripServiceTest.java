package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.TripSummary;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TripServiceTest {

    @Mock
    private TripRepository tripRepo;

    @Mock
    private UserRepository userRepo;

    private TripService tripService;

    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        tripService = new TripService(tripRepo, userRepo);
        userId = UUID.randomUUID();
        user = new User("testUser", "test@test.com", "encoded-password", userId);
    }

    @Test
    void createTrip_WhenUserExists_ShouldSaveTripAndReturnItsId() {
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));

        tripService.createTrip("Mi Viaje", userId);

        ArgumentCaptor<Trip> tripCaptor = ArgumentCaptor.forClass(Trip.class);
        verify(tripRepo).save(tripCaptor.capture());

        Trip savedTrip = tripCaptor.getValue();
        assertEquals("Mi Viaje", savedTrip.getName());
        assertEquals(user, savedTrip.getOwner());
    }

    @Test
    void createTrip_WhenUserExists_ShouldLookupUserBeforeSavingTrip() {
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));

        tripService.createTrip("Mi Viaje", userId);

        var inOrder = inOrder(userRepo, tripRepo);
        inOrder.verify(userRepo).findById(userId);
        inOrder.verify(tripRepo).save(any(Trip.class));
    }

    @Test
    void createTrip_WhenUserDoesNotExist_ShouldThrowAndNotSaveTrip() {
        when(userRepo.findById(userId)).thenReturn(Optional.empty());

        assertThrows(NoSuchElementException.class, () -> tripService.createTrip("Mi Viaje", userId));

        verify(tripRepo, never()).save(any(Trip.class));
    }

    @Test
    void listTrips_WhenUserExists_ShouldReturnSummariesForAllMemberTrips() {
        Trip trip1 = mock(Trip.class);
        Trip trip2 = mock(Trip.class);
        TripSummary summary1 = mock(TripSummary.class);
        TripSummary summary2 = mock(TripSummary.class);

        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        when(tripRepo.findAllByMembersContaining(user)).thenReturn(List.of(trip1, trip2));
        when(trip1.toTripSummary()).thenReturn(summary1);
        when(trip2.toTripSummary()).thenReturn(summary2);

        List<TripSummary> result = tripService.listTrips(userId);

        assertEquals(2, result.size());
        assertTrue(result.containsAll(List.of(summary1, summary2)));
    }

    @Test
    void listTrips_WhenUserHasNoTrips_ShouldReturnEmptyList() {
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        when(tripRepo.findAllByMembersContaining(user)).thenReturn(List.of());

        List<TripSummary> result = tripService.listTrips(userId);

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void listTrips_ShouldQueryTripsByResolvedUser() {
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        when(tripRepo.findAllByMembersContaining(user)).thenReturn(List.of());

        tripService.listTrips(userId);

        var inOrder = inOrder(userRepo, tripRepo);
        inOrder.verify(userRepo).findById(userId);
        inOrder.verify(tripRepo).findAllByMembersContaining(user);
    }

    @Test
    void listTrips_WhenUserDoesNotExist_ShouldThrowAndNotQueryTrips() {
        when(userRepo.findById(userId)).thenReturn(Optional.empty());

        assertThrows(NoSuchElementException.class, () -> tripService.listTrips(userId));

        verifyNoInteractions(tripRepo);
    }
}
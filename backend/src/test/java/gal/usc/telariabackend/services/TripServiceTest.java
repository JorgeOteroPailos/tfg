package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.JoinRequest;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.JoinRequestSummary;
import gal.usc.telariabackend.model.dto.TripDetail;
import gal.usc.telariabackend.model.dto.TripSummary;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.JoinRequestRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TripServiceTest {

    @Mock
    private TripRepository tripRepo;

    @Mock
    private UserRepository userRepo;

    @Mock
    private JoinRequestRepository joinRequestRepo;

    private TripService tripService;

    private UUID userId;
    private User user;
    private UUID tripId;
    private Trip trip;

    @BeforeEach
    void setUp() {
        tripService = new TripService(tripRepo, userRepo, joinRequestRepo);
        userId = UUID.randomUUID();
        tripId = UUID.randomUUID();
        user = new User("testUser", "test@test.com", "encoded-password", userId);
        trip = mock(Trip.class);
    }


    @Test
    void createTrip_WhenUserExists_ShouldSaveTripAndReturnItsId() {
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));

        tripService.createTrip("Mi Viaje", userId);

        ArgumentCaptor<Trip> tripCaptor = ArgumentCaptor.forClass(Trip.class);
        verify(tripRepo).save(tripCaptor.capture());

        Trip savedTrip = tripCaptor.getValue();
        assertEquals("Mi Viaje", savedTrip.getName());
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

        when(tripRepo.findAllByMembersId(userId)).thenReturn(List.of(trip1, trip2));
        when(trip1.toTripSummary()).thenReturn(summary1);
        when(trip2.toTripSummary()).thenReturn(summary2);

        List<TripSummary> result = tripService.listTrips(userId);

        assertEquals(2, result.size());
        assertTrue(result.containsAll(List.of(summary1, summary2)));
    }

    @Test
    void listTrips_WhenUserHasNoTrips_ShouldReturnEmptyList() {
        when(tripRepo.findAllByMembersId(userId)).thenReturn(List.of());

        List<TripSummary> result = tripService.listTrips(userId);

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void listTrips_ShouldQueryTripsByUserId() {
        when(tripRepo.findAllByMembersId(userId)).thenReturn(List.of());

        tripService.listTrips(userId);

        verify(tripRepo).findAllByMembersId(userId);
        verifyNoInteractions(userRepo);
    }

    @Test
    void listTrips_WhenUserDoesNotExist_ShouldReturnEmptyList() {
        when(tripRepo.findAllByMembersId(userId)).thenReturn(List.of());

        List<TripSummary> result = tripService.listTrips(userId);

        assertTrue(result.isEmpty());
        verifyNoInteractions(userRepo);
    }

    @Test
    void getTripDetails_WhenUserIsMember_ShouldReturnDetailsWithMembersAndPendingRequests() {
        User member = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        Set<User> members = new HashSet<>(Set.of(user, member));
        JoinRequest joinRequest = mock(JoinRequest.class);
        JoinRequestSummary summary = mock(JoinRequestSummary.class);
        Trip realTrip = mock(Trip.class);

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(realTrip));
        when(realTrip.getId()).thenReturn(tripId);
        when(realTrip.getName()).thenReturn("Viaje a Roma");
        when(realTrip.getMembers()).thenReturn(members);
        when(joinRequestRepo.findAllByTrip(realTrip)).thenReturn(List.of(joinRequest));
        when(joinRequest.toJoinRequestSummary()).thenReturn(summary);

        TripDetail result = tripService.getTripDetails(tripId, userId);

        assertEquals(tripId, result.getId());
        assertEquals("Viaje a Roma", result.getName());
        assertEquals(2, result.getMembers().size());
        assertEquals(1, result.getPendingRequests().size());
        assertSame(summary, result.getPendingRequests().getFirst());
    }

    @Test
    void getTripDetails_WhenNoPendingRequests_ShouldReturnEmptyPendingRequests() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getMembers()).thenReturn(Set.of(user));
        when(joinRequestRepo.findAllByTrip(trip)).thenReturn(List.of());

        TripDetail result = tripService.getTripDetails(tripId, userId);

        assertTrue(result.getPendingRequests().isEmpty());
    }

    @Test
    void getTripDetails_WhenUserIsNotMember_ShouldThrowAccessDenied() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class, () -> tripService.getTripDetails(tripId, userId));
    }

    @Test
    void getTripDetails_WhenUserDoesNotExist_ShouldThrowAndNotQueryTrips() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class, () -> tripService.getTripDetails(tripId, userId));

        verifyNoInteractions(joinRequestRepo);
    }

    @Test
    void getTripDetails_WhenTripDoesNotExist_ShouldThrowAccessDenied() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class, () -> tripService.getTripDetails(tripId, userId));
    }
}
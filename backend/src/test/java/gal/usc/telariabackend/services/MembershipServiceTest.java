package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.Invitation;
import gal.usc.telariabackend.model.JoinRequest;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.InvitationSummary;
import gal.usc.telariabackend.model.exceptions.AlreadyDoneException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.model.exceptions.TripNotFoundException;
import gal.usc.telariabackend.repository.AiChatMessageRepository;
import gal.usc.telariabackend.repository.InvitationRepository;
import gal.usc.telariabackend.repository.JoinRequestRepository;
import gal.usc.telariabackend.repository.TripChatMessageRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import gal.usc.telariabackend.services.SharedDocumentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MembershipServiceTest {

    @Mock
    private InvitationRepository invitationRepo;
    @Mock
    private JoinRequestRepository joinRequestRepo;
    @Mock
    private TripRepository tripRepo;
    @Mock
    private UserRepository userRepo;
    @Mock
    private SharedDocumentService sharedDocumentService;
    @Mock
    private TripChatMessageRepository tripChatMessageRepo;
    @Mock
    private AiChatMessageRepository aiChatMessageRepo;

    private MembershipService membershipService;

    private UUID userId;
    private UUID tripId;
    private User user;
    private Trip trip;

    @BeforeEach
    void setUp() {
        membershipService = new MembershipService(invitationRepo, joinRequestRepo, tripRepo, userRepo,
                sharedDocumentService, tripChatMessageRepo, aiChatMessageRepo);
        userId = UUID.randomUUID();
        tripId = UUID.randomUUID();
        user = new User("pepe", "pepe@example.com", "encoded", userId);
        trip = mock(Trip.class);
    }

    // createInvitation

    @Test
    void createInvitation_WhenCreatorIsMemberAndInvitedIsNot_ShouldSaveInvitation() {
        UUID invitedId = UUID.randomUUID();
        User invited = new User("manolo", "manolo@hotmail.com", "encoded", invitedId);

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(invitedId)).thenReturn(Optional.of(invited));
        doNothing().when(trip).assertIsNotMember(invitedId);

        membershipService.createInvitation(invitedId, userId, tripId);

        ArgumentCaptor<Invitation> captor = ArgumentCaptor.forClass(Invitation.class);
        verify(invitationRepo).save(captor.capture());
        assertEquals(trip, captor.getValue().getTrip());
        assertEquals(invited, captor.getValue().getUser());
    }

    @Test
    void createInvitation_WhenCreatorIsNotMember_ShouldThrowAndNotSaveInvitation() {
        UUID invitedId = UUID.randomUUID();

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class,
                () -> membershipService.createInvitation(invitedId, userId, tripId));

        verifyNoInteractions(invitationRepo);
    }

    @Test
    void createInvitation_WhenInvitedIsAlreadyMember_ShouldThrowAndNotSaveInvitation() {
        UUID invitedId = UUID.randomUUID();

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));

        doThrow(AlreadyDoneException.class).when(trip).assertIsNotMember(invitedId);

        assertThrows(AlreadyDoneException.class,
                () -> membershipService.createInvitation(invitedId, userId, tripId));

        verifyNoInteractions(invitationRepo);
    }

    // createJoinRequest

    @Test
    void createJoinRequest_WhenUserIsNotMember_ShouldSaveJoinRequest() {
        when(tripRepo.findById(tripId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        doNothing().when(trip).assertIsNotMember(user);

        membershipService.createJoinRequest(userId, tripId);

        ArgumentCaptor<JoinRequest> captor = ArgumentCaptor.forClass(JoinRequest.class);
        verify(joinRequestRepo).save(captor.capture());
        assertEquals(trip, captor.getValue().getTrip());
        assertEquals(user, captor.getValue().getUser());
    }

    @Test
    void createJoinRequest_WhenTripDoesNotExist_ShouldThrowAndNotSaveRequest() {
        when(tripRepo.findById(tripId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class,
                () -> membershipService.createJoinRequest(userId, tripId));

        verifyNoInteractions(joinRequestRepo);
    }

    @Test
    void createJoinRequest_WhenUserIsAlreadyMember_ShouldThrowAndNotSaveRequest() {
        when(tripRepo.findById(tripId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        doThrow(AlreadyDoneException.class).when(trip).assertIsNotMember(user);

        assertThrows(AlreadyDoneException.class,
                () -> membershipService.createJoinRequest(userId, tripId));

        verifyNoInteractions(joinRequestRepo);
    }

    // leaveTrip

    @Test
    void leaveTrip_WhenUserIsMemberAndOthersRemain_ShouldRemoveUserSaveTripAndNotDeleteIt() {
        User otherMember = new User("other", "other@example.com", "encoded", UUID.randomUUID());
        Set<User> members = new HashSet<>(Set.of(user, otherMember));
        when(tripRepo.findById(tripId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        doNothing().when(trip).assertIsMember(user);
        when(trip.getMembers()).thenReturn(members);

        membershipService.leaveTrip(userId, tripId);

        verify(tripRepo).save(trip);
        verify(tripRepo, never()).delete(any());
        verifyNoInteractions(sharedDocumentService, tripChatMessageRepo, aiChatMessageRepo);
    }

    @Test
    void leaveTrip_WhenLastMemberLeaves_ShouldCleanUpAllTripDataAndDeleteTrip() {
        Set<User> members = new HashSet<>(Set.of(user));
        when(tripRepo.findById(tripId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        doNothing().when(trip).assertIsMember(user);
        when(trip.getMembers()).thenReturn(members);

        membershipService.leaveTrip(userId, tripId);

        verify(sharedDocumentService).deleteAllForTrip(tripId);
        verify(invitationRepo).deleteAllByTripId(tripId);
        verify(joinRequestRepo).deleteAllByTripId(tripId);
        verify(tripChatMessageRepo).deleteAllByTripId(tripId);
        verify(aiChatMessageRepo).deleteAllByTripId(tripId);
        verify(tripRepo).delete(trip);
    }

    @Test
    void leaveTrip_WhenTripDoesNotExist_ShouldThrow() {
        when(tripRepo.findById(tripId)).thenReturn(Optional.empty());

        assertThrows(TripNotFoundException.class,
                () -> membershipService.leaveTrip(userId, tripId));

        verify(tripRepo, never()).save(any());
        verify(tripRepo, never()).delete(any());
    }

    @Test
    void leaveTrip_WhenUserIsNotMember_ShouldThrowAndNotSaveTrip() {
        when(tripRepo.findById(tripId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        doThrow(NotATripMemberException.class).when(trip).assertIsMember(user);

        assertThrows(NotATripMemberException.class,
                () -> membershipService.leaveTrip(userId, tripId));

        verify(tripRepo, never()).save(any());
        verify(tripRepo, never()).delete(any());
    }

    // resolveInvitation

    @Test
    void resolveInvitation_WhenAccepted_ShouldAddUserToTripAndDeleteInvitation() {
        Invitation invitation = mock(Invitation.class);
        when(invitationRepo.findById(any())).thenReturn(Optional.of(invitation));
        when(invitation.getTrip()).thenReturn(trip);
        when(invitation.getUser()).thenReturn(user);
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        doNothing().when(trip).assertIsNotMember(user);

        membershipService.resolveInvitation(UUID.randomUUID(), userId, true);

        verify(trip).getMembers();
        verify(invitationRepo).delete(invitation);
    }

    @Test
    void resolveInvitation_WhenRejected_ShouldNotAddUserToTripButDeleteInvitation() {
        Invitation invitation = mock(Invitation.class);
        when(invitationRepo.findById(any())).thenReturn(Optional.of(invitation));
        when(invitation.getTrip()).thenReturn(trip);
        when(invitation.getUser()).thenReturn(user);
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        doNothing().when(trip).assertIsNotMember(user);

        membershipService.resolveInvitation(UUID.randomUUID(), userId, false);

        verify(trip, never()).getMembers();
        verify(invitationRepo).delete(invitation);
    }

    @Test
    void resolveInvitation_WhenWrongUser_ShouldThrowAccessDeniedAndNotDeleteInvitation() {
        UUID otherUserId = UUID.randomUUID();
        User otherUser = new User("lola", "lola@test.com", "encoded", otherUserId);
        Invitation invitation = mock(Invitation.class);

        when(invitationRepo.findById(any())).thenReturn(Optional.of(invitation));
        when(invitation.getTrip()).thenReturn(trip);
        when(invitation.getUser()).thenReturn(user);
        when(userRepo.findById(otherUserId)).thenReturn(Optional.of(otherUser));
        doNothing().when(trip).assertIsNotMember(user);

        assertThrows(AccessDeniedException.class,
                () -> membershipService.resolveInvitation(UUID.randomUUID(), otherUserId, true));

        verify(invitationRepo, never()).delete(any());
    }

    @Test
    void resolveInvitation_WhenUserIsAlreadyMember_ShouldThrowAndNotDeleteInvitation() {
        Invitation invitation = mock(Invitation.class);

        when(invitationRepo.findById(any())).thenReturn(Optional.of(invitation));
        when(invitation.getTrip()).thenReturn(trip);
        when(invitation.getUser()).thenReturn(user);
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        doThrow(AlreadyDoneException.class).when(trip).assertIsNotMember(user);

        assertThrows(AlreadyDoneException.class,
                () -> membershipService.resolveInvitation(UUID.randomUUID(), userId, true));

        verify(invitationRepo, never()).delete(any());
    }

    // resolveJoinRequest

    @Test
    void resolveJoinRequest_WhenAccepted_ShouldAddRequesterToTripAndDeleteRequest() {
        UUID requesterId = UUID.randomUUID();
        User requester = new User("fran", "fran@gmail.com", "encoded", requesterId);
        JoinRequest request = mock(JoinRequest.class);

        when(joinRequestRepo.findById(any())).thenReturn(Optional.of(request));
        when(tripRepo.findById(tripId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        when(request.getUser()).thenReturn(requester);
        doNothing().when(trip).assertIsMember(user);
        doNothing().when(trip).assertIsNotMember(requester);

        membershipService.resolveJoinRequest(UUID.randomUUID(), tripId, userId, true);

        verify(trip).getMembers();
        verify(joinRequestRepo).delete(request);
    }

    @Test
    void resolveJoinRequest_WhenRejected_ShouldNotAddRequesterToTripButDeleteRequest() {
        UUID requesterId = UUID.randomUUID();
        User requester = new User("fran", "fran@gmail.com", "encoded", requesterId);
        JoinRequest request = mock(JoinRequest.class);

        when(joinRequestRepo.findById(any())).thenReturn(Optional.of(request));
        when(tripRepo.findById(tripId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        when(request.getUser()).thenReturn(requester);
        doNothing().when(trip).assertIsMember(user);
        doNothing().when(trip).assertIsNotMember(requester);

        membershipService.resolveJoinRequest(UUID.randomUUID(), tripId, userId, false);

        verify(trip, never()).getMembers();
        verify(joinRequestRepo).delete(request);
    }

    @Test
    void resolveJoinRequest_WhenResolverIsNotMember_ShouldThrowAndNotDeleteRequest() {
        JoinRequest request = mock(JoinRequest.class);

        when(joinRequestRepo.findById(any())).thenReturn(Optional.of(request));
        when(tripRepo.findById(tripId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        doThrow(NotATripMemberException.class).when(trip).assertIsMember(user);

        assertThrows(NotATripMemberException.class,
                () -> membershipService.resolveJoinRequest(UUID.randomUUID(), tripId, userId, true));

        verify(joinRequestRepo, never()).delete(any());
    }

    @Test
    void resolveJoinRequest_WhenRequesterIsAlreadyMember_ShouldThrowAndNotDeleteRequest() {
        UUID requesterId = UUID.randomUUID();
        User requester = new User("fran", "fran@gmail.com", "encoded", requesterId);
        JoinRequest request = mock(JoinRequest.class);

        when(joinRequestRepo.findById(any())).thenReturn(Optional.of(request));
        when(tripRepo.findById(tripId)).thenReturn(Optional.of(trip));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        when(request.getUser()).thenReturn(requester);
        doNothing().when(trip).assertIsMember(user);
        doThrow(AlreadyDoneException.class).when(trip).assertIsNotMember(requester);

        assertThrows(AlreadyDoneException.class,
                () -> membershipService.resolveJoinRequest(UUID.randomUUID(), tripId, userId, true));

        verify(joinRequestRepo, never()).delete(any());
    }

    // getMyInvitations

    @Test
    void getMyInvitations_ShouldReturnSummariesForAllPendingInvitations() {
        Invitation inv1 = mock(Invitation.class);
        Invitation inv2 = mock(Invitation.class);
        InvitationSummary summary1 = mock(InvitationSummary.class);
        InvitationSummary summary2 = mock(InvitationSummary.class);

        when(invitationRepo.findByUserId(userId)).thenReturn(List.of(inv1, inv2));
        when(inv1.toInvitationSummary()).thenReturn(summary1);
        when(inv2.toInvitationSummary()).thenReturn(summary2);

        List<InvitationSummary> result = membershipService.getMyInvitations(userId);

        assertEquals(2, result.size());
        assertTrue(result.containsAll(List.of(summary1, summary2)));
    }

    @Test
    void getMyInvitations_WhenNoInvitations_ShouldReturnEmptyList() {
        when(invitationRepo.findByUserId(userId)).thenReturn(List.of());

        List<InvitationSummary> result = membershipService.getMyInvitations(userId);

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }
}
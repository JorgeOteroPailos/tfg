package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.FriendRequest;
import gal.usc.telariabackend.model.Friendship;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.FriendRequestSummary;
import gal.usc.telariabackend.model.dto.UserProfile;
import gal.usc.telariabackend.model.exceptions.AlreadyDoneException;
import gal.usc.telariabackend.repository.FriendRequestRepository;
import gal.usc.telariabackend.repository.FriendshipRepository;
import gal.usc.telariabackend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FriendServiceTest {

    @Mock
    private FriendRequestRepository friendRequestRepo;
    @Mock
    private FriendshipRepository friendshipRepo;
    @Mock
    private UserRepository userRepo;

    private FriendService friendService;

    private UUID senderId;
    private UUID receiverId;
    private User sender;
    private User receiver;

    @BeforeEach
    void setUp() {
        friendService = new FriendService(friendRequestRepo, friendshipRepo, userRepo);
        senderId = UUID.randomUUID();
        receiverId = UUID.randomUUID();
        sender = new User("pepe", "pepe@example.com", "encoded", senderId);
        receiver = new User("manolo", "manolo@example.com", "encoded", receiverId);
    }

    // sendFriendRequestById

    @Test
    void sendFriendRequest_WhenNoPriorRelation_ShouldSaveRequest() {
        when(userRepo.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepo.findById(receiverId)).thenReturn(Optional.of(receiver));
        when(friendshipRepo.existsByUserIds(senderId, receiverId)).thenReturn(false);
        when(friendRequestRepo.existsBySenderAndReceiver(sender, receiver)).thenReturn(false);
        when(friendRequestRepo.existsBySenderAndReceiver(receiver, sender)).thenReturn(false);

        friendService.sendFriendRequestById(senderId, receiverId);

        ArgumentCaptor<FriendRequest> captor = ArgumentCaptor.forClass(FriendRequest.class);
        verify(friendRequestRepo).save(captor.capture());
        assertEquals(sender, captor.getValue().getSender());
        assertEquals(receiver, captor.getValue().getReceiver());
    }

    @Test
    void sendFriendRequest_ToSelf_ShouldThrowAndNotSave() {
        when(userRepo.findById(senderId)).thenReturn(Optional.of(sender));

        assertThrows(AlreadyDoneException.class,
                () -> friendService.sendFriendRequestById(senderId, senderId));

        verify(friendRequestRepo, never()).save(any());
    }

    @Test
    void sendFriendRequest_WhenAlreadyFriends_ShouldThrowAndNotSave() {
        when(userRepo.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepo.findById(receiverId)).thenReturn(Optional.of(receiver));
        when(friendshipRepo.existsByUserIds(senderId, receiverId)).thenReturn(true);

        assertThrows(AlreadyDoneException.class,
                () -> friendService.sendFriendRequestById(senderId, receiverId));

        verify(friendRequestRepo, never()).save(any());
    }

    @Test
    void sendFriendRequest_WhenForwardRequestAlreadyExists_ShouldThrowAndNotSave() {
        when(userRepo.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepo.findById(receiverId)).thenReturn(Optional.of(receiver));
        when(friendshipRepo.existsByUserIds(senderId, receiverId)).thenReturn(false);
        when(friendRequestRepo.existsBySenderAndReceiver(sender, receiver)).thenReturn(true);

        assertThrows(AlreadyDoneException.class,
                () -> friendService.sendFriendRequestById(senderId, receiverId));

        verify(friendRequestRepo, never()).save(any());
    }

    @Test
    void sendFriendRequest_WhenReverseRequestAlreadyExists_ShouldThrowAndNotSave() {
        // The receiver already sent a request to the sender; sending back must be rejected
        when(userRepo.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepo.findById(receiverId)).thenReturn(Optional.of(receiver));
        when(friendshipRepo.existsByUserIds(senderId, receiverId)).thenReturn(false);
        when(friendRequestRepo.existsBySenderAndReceiver(sender, receiver)).thenReturn(false);
        when(friendRequestRepo.existsBySenderAndReceiver(receiver, sender)).thenReturn(true);

        assertThrows(AlreadyDoneException.class,
                () -> friendService.sendFriendRequestById(senderId, receiverId));

        verify(friendRequestRepo, never()).save(any());
    }

    @Test
    void sendFriendRequest_WhenReceiverNotFound_ShouldThrowAndNotSave() {
        when(userRepo.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepo.findById(receiverId)).thenReturn(Optional.empty());

        assertThrows(NoSuchElementException.class,
                () -> friendService.sendFriendRequestById(senderId, receiverId));

        verify(friendRequestRepo, never()).save(any());
    }

    // getMyFriendRequests

    @Test
    void getMyFriendRequests_ShouldMapSenderProfiles() {
        FriendRequest request = new FriendRequest(sender, receiver);
        when(friendRequestRepo.findByReceiverId(receiverId)).thenReturn(List.of(request));

        List<FriendRequestSummary> result = friendService.getMyFriendRequests(receiverId);

        assertEquals(1, result.size());
        assertEquals(sender.getId(), result.getFirst().getSender().getId());
        assertEquals(sender.getUsername(), result.getFirst().getSender().getUsername());
    }

    // resolveFriendRequest

    @Test
    void resolveFriendRequest_WhenAccepted_ShouldCreateFriendshipAndDeleteRequest() {
        UUID requestId = UUID.randomUUID();
        FriendRequest request = new FriendRequest(sender, receiver);
        when(friendRequestRepo.findById(requestId)).thenReturn(Optional.of(request));
        when(friendshipRepo.existsByUserIds(senderId, receiverId)).thenReturn(false);

        friendService.resolveFriendRequest(requestId, receiverId, true);

        verify(friendshipRepo).save(any(Friendship.class));
        verify(friendRequestRepo).delete(request);
    }

    @Test
    void resolveFriendRequest_WhenRejected_ShouldDeleteRequestWithoutFriendship() {
        UUID requestId = UUID.randomUUID();
        FriendRequest request = new FriendRequest(sender, receiver);
        when(friendRequestRepo.findById(requestId)).thenReturn(Optional.of(request));

        friendService.resolveFriendRequest(requestId, receiverId, false);

        verify(friendshipRepo, never()).save(any());
        verify(friendRequestRepo).delete(request);
    }

    @Test
    void resolveFriendRequest_WhenAcceptedButAlreadyFriends_ShouldNotDuplicateFriendship() {
        UUID requestId = UUID.randomUUID();
        FriendRequest request = new FriendRequest(sender, receiver);
        when(friendRequestRepo.findById(requestId)).thenReturn(Optional.of(request));
        when(friendshipRepo.existsByUserIds(senderId, receiverId)).thenReturn(true);

        friendService.resolveFriendRequest(requestId, receiverId, true);

        verify(friendshipRepo, never()).save(any());
        verify(friendRequestRepo).delete(request);
    }

    @Test
    void resolveFriendRequest_WhenResolverIsNotRecipient_ShouldThrowAndNotDeleteRequest() {
        UUID requestId = UUID.randomUUID();
        FriendRequest request = new FriendRequest(sender, receiver);
        when(friendRequestRepo.findById(requestId)).thenReturn(Optional.of(request));

        assertThrows(AccessDeniedException.class,
                () -> friendService.resolveFriendRequest(requestId, UUID.randomUUID(), true));

        verify(friendRequestRepo, never()).delete(any());
        verify(friendshipRepo, never()).save(any());
    }

    @Test
    void resolveFriendRequest_WhenRequestNotFound_ShouldThrow() {
        UUID requestId = UUID.randomUUID();
        when(friendRequestRepo.findById(requestId)).thenReturn(Optional.empty());

        assertThrows(NoSuchElementException.class,
                () -> friendService.resolveFriendRequest(requestId, receiverId, true));

        verify(friendRequestRepo, never()).delete(any());
    }

    // getMyFriends

    @Test
    void getMyFriends_ShouldReturnTheOtherSideOfEachFriendship() {
        Friendship friendship = new Friendship(sender, receiver);
        when(friendshipRepo.findAllByUserId(senderId)).thenReturn(List.of(friendship));

        List<UserProfile> result = friendService.getMyFriends(senderId);

        assertEquals(1, result.size());
        assertEquals(receiverId, result.getFirst().getId());
        assertEquals(receiver.getUsername(), result.getFirst().getUsername());
    }

    // removeFriend

    @Test
    void removeFriend_WhenFriendshipExists_ShouldDelete() {
        Friendship friendship = new Friendship(sender, receiver);
        when(friendshipRepo.findByUserIds(senderId, receiverId)).thenReturn(Optional.of(friendship));

        friendService.removeFriend(senderId, receiverId);

        verify(friendshipRepo).delete(friendship);
    }

    @Test
    void removeFriend_WhenFriendshipNotFound_ShouldThrowAndNotDelete() {
        when(friendshipRepo.findByUserIds(senderId, receiverId)).thenReturn(Optional.empty());

        assertThrows(NoSuchElementException.class,
                () -> friendService.removeFriend(senderId, receiverId));

        verify(friendshipRepo, never()).delete(any());
    }
}

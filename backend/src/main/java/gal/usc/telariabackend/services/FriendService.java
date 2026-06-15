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
import jakarta.transaction.Transactional;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
public class FriendService {

    private final FriendRequestRepository friendRequestRepo;
    private final FriendshipRepository friendshipRepo;
    private final UserRepository userRepo;

    public FriendService(FriendRequestRepository friendRequestRepo,
                         FriendshipRepository friendshipRepo,
                         UserRepository userRepo) {
        this.friendRequestRepo = friendRequestRepo;
        this.friendshipRepo = friendshipRepo;
        this.userRepo = userRepo;
    }

    @Transactional
    public void sendFriendRequestById(UUID senderId, UUID receiverId) {
        User sender = userRepo.findById(senderId).orElseThrow(IllegalStateException::new);
        User receiver = userRepo.findById(receiverId)
                .orElseThrow(() -> new NoSuchElementException("User not found"));
        sendFriendRequestToUser(sender, receiver);
    }

    private void sendFriendRequestToUser(User sender, User receiver) {
        if (sender.getId().equals(receiver.getId())) {
            throw new AlreadyDoneException("Cannot send a friend request to yourself");
        }
        if (friendshipRepo.existsByUserIds(sender.getId(), receiver.getId())) {
            throw new AlreadyDoneException("Already friends with this user");
        }
        if (friendRequestRepo.existsBySenderAndReceiver(sender, receiver)
                || friendRequestRepo.existsBySenderAndReceiver(receiver, sender)) {
            throw new AlreadyDoneException("Friend request already pending");
        }
        friendRequestRepo.save(new FriendRequest(sender, receiver));
    }

    @Transactional
    public List<FriendRequestSummary> getMyFriendRequests(UUID userId) {
        return friendRequestRepo.findByReceiverId(userId).stream()
                .map(req -> new FriendRequestSummary()
                        .id(req.getId())
                        .sender(req.getSender().toUserProfile()))
                .toList();
    }

    @Transactional
    public void resolveFriendRequest(UUID requestId, UUID receiverId, boolean accepted) {
        FriendRequest request = friendRequestRepo.findById(requestId)
                .orElseThrow(() -> new NoSuchElementException("Friend request not found"));
        if (!request.getReceiver().getId().equals(receiverId)) {
            throw new AccessDeniedException("Only the recipient can accept or reject this friend request");
        }
        if (accepted) {
            User sender = request.getSender();
            User receiver = request.getReceiver();
            if (!friendshipRepo.existsByUserIds(sender.getId(), receiver.getId())) {
                friendshipRepo.save(new Friendship(sender, receiver));
            }
        }
        friendRequestRepo.delete(request);
    }

    @Transactional
    public List<UserProfile> getMyFriends(UUID userId) {
        return friendshipRepo.findAllByUserId(userId).stream()
                .map(f -> f.getFriendOf(userId).toUserProfile())
                .toList();
    }

    @Transactional
    public void removeFriend(UUID userId, UUID friendId) {
        Friendship friendship = friendshipRepo.findByUserIds(userId, friendId)
                .orElseThrow(() -> new NoSuchElementException("Friendship not found"));
        friendshipRepo.delete(friendship);
    }
}

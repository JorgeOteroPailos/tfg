package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.dto.FriendRequestSummary;
import gal.usc.telariabackend.model.dto.ResolveFriendRequest;
import gal.usc.telariabackend.model.dto.UserProfile;
import gal.usc.telariabackend.services.FriendService;
import gal.usc.telariabackend.utils.SecurityHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.NativeWebRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
public class FriendController implements FriendsApi {

    private final FriendService friendService;
    private final SecurityHelper securityHelper;

    public FriendController(FriendService friendService, SecurityHelper securityHelper) {
        this.friendService = friendService;
        this.securityHelper = securityHelper;
    }

    @Override
    public Optional<NativeWebRequest> getRequest() {
        return FriendsApi.super.getRequest();
    }

    @Override
    public ResponseEntity<Void> sendFriendRequestById(UUID userId) {
        friendService.sendFriendRequestById(securityHelper.getUserId(), userId);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<List<FriendRequestSummary>> getMyFriendRequests() {
        return ResponseEntity.ok(friendService.getMyFriendRequests(securityHelper.getUserId()));
    }

    @Override
    public ResponseEntity<Void> resolveFriendRequest(UUID requestId, ResolveFriendRequest body) {
        friendService.resolveFriendRequest(requestId, securityHelper.getUserId(), body.getAccepted());
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<List<UserProfile>> getMyFriends() {
        return ResponseEntity.ok(friendService.getMyFriends(securityHelper.getUserId()));
    }

    @Override
    public ResponseEntity<Void> removeFriend(UUID friendId) {
        friendService.removeFriend(securityHelper.getUserId(), friendId);
        return ResponseEntity.noContent().build();
    }
}

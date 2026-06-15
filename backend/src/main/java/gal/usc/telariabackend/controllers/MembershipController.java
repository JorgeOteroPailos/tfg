package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.dto.CreateInvitationRequest;
import gal.usc.telariabackend.model.dto.InvitationSummary;
import gal.usc.telariabackend.model.dto.ResolveJoinRequest;
import gal.usc.telariabackend.services.MembershipService;
import gal.usc.telariabackend.utils.SecurityHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.NativeWebRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
public class MembershipController implements MembershipApi{

    private final MembershipService membershipService;

    private final SecurityHelper securityHelper;

    public MembershipController(SecurityHelper securityHelper, MembershipService membershipService) {
        this.securityHelper = securityHelper;
        this.membershipService = membershipService;
    }

    @Override
    public Optional<NativeWebRequest> getRequest() {
        return MembershipApi.super.getRequest();
    }

    @Override
    public ResponseEntity<Void> createInvitation(UUID userId, CreateInvitationRequest createInvitationRequest) {
        membershipService.createInvitation(userId, securityHelper.getUserId(), createInvitationRequest.getTripId());
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> createJoinRequest(UUID tripId) {
        membershipService.createJoinRequest(securityHelper.getUserId(), tripId);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<List<InvitationSummary>> getMyInvitations() {
        return ResponseEntity.ok(membershipService.getMyInvitations(securityHelper.getUserId()));
    }

    @Override
    public ResponseEntity<Void> leaveTrip(UUID tripId) {
        membershipService.leaveTrip(securityHelper.getUserId(),tripId);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> resolveInvitation(UUID invitationId, ResolveJoinRequest resolveJoinRequest) {
        membershipService.resolveInvitation(invitationId, securityHelper.getUserId(), resolveJoinRequest.getAccepted());
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> resolveJoinRequest(UUID tripId, UUID requestId, ResolveJoinRequest resolveJoinRequest) {
        membershipService.resolveJoinRequest(requestId, tripId, securityHelper.getUserId(), resolveJoinRequest.getAccepted());
        return ResponseEntity.noContent().build();
    }
}

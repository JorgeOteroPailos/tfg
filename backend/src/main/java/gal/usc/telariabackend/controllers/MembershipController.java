package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.dto.CreateInvitationRequest;
import gal.usc.telariabackend.model.dto.CreateTrip201Response;
import gal.usc.telariabackend.model.dto.InvitationSummary;
import gal.usc.telariabackend.model.dto.ResolveJoinRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.NativeWebRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
public class MembershipController implements MembershipApi{

    @Override
    public Optional<NativeWebRequest> getRequest() {
        return MembershipApi.super.getRequest();
    }

    @Override
    public ResponseEntity<CreateTrip201Response> createInvitation(UUID userId, CreateInvitationRequest createInvitationRequest) {
        return MembershipApi.super.createInvitation(userId, createInvitationRequest);
    }

    @Override
    public ResponseEntity<Void> createJoinRequest(UUID tripId) {
        return MembershipApi.super.createJoinRequest(tripId);
    }

    @Override
    public ResponseEntity<List<InvitationSummary>> getMyInvitations() {
        return MembershipApi.super.getMyInvitations();
    }

    @Override
    public ResponseEntity<Void> leaveTrip(UUID tripId) {
        return MembershipApi.super.leaveTrip(tripId);
    }

    @Override
    public ResponseEntity<Void> resolveInvitation(UUID invitationId, ResolveJoinRequest resolveJoinRequest) {
        return MembershipApi.super.resolveInvitation(invitationId, resolveJoinRequest);
    }

    @Override
    public ResponseEntity<Void> resolveJoinRequest(UUID tripId, UUID requestId, ResolveJoinRequest resolveJoinRequest) {
        return MembershipApi.super.resolveJoinRequest(tripId, requestId, resolveJoinRequest);
    }
}

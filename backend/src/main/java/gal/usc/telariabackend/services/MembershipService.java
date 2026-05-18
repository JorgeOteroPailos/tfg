package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.Invitation;
import gal.usc.telariabackend.model.JoinRequest;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.InvitationSummary;
import gal.usc.telariabackend.model.exceptions.AlreadyDoneException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.model.exceptions.TripNotFoundException;
import gal.usc.telariabackend.repository.InvitationRepository;
import gal.usc.telariabackend.repository.JoinRequestRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class MembershipService {
    private final InvitationRepository invitationRepo;
    private final JoinRequestRepository joinRequestRepo;
    private final TripRepository tripRepo;
    private final UserRepository userRepo;

    public MembershipService(InvitationRepository invitationRepo, JoinRequestRepository joinRequestRepo, TripRepository tripRepo, UserRepository userRepo) {
        this.invitationRepo = invitationRepo;
        this.joinRequestRepo = joinRequestRepo;
        this.tripRepo = tripRepo;
        this.userRepo = userRepo;
    }

    public void createInvitation(UUID invitedUserId,UUID creatorId, @NotNull @Valid UUID tripId) {
        Trip trip=tripRepo.findByIdAndMembersId(tripId, creatorId)
                .orElseThrow(NotATripMemberException::new);
        trip.assertIsNotMember(invitedUserId);
        User user= userRepo.findById(invitedUserId).orElseThrow(IllegalStateException::new);
        Invitation invitation=new Invitation(trip, user);
        if(invitationRepo.existsByTripAndUser(trip, user)){throw new AlreadyDoneException("Already invited this user to the trip");}
        invitationRepo.save(invitation);
    }

    public void createJoinRequest(UUID userId, UUID tripId){
        Trip trip=tripRepo.findById(tripId).orElseThrow(NotATripMemberException::new);
        User user =userRepo.findById(userId).orElseThrow(IllegalStateException::new);
        trip.assertIsNotMember(user);
        if(joinRequestRepo.existsByTripAndUser(trip, user)){throw new AlreadyDoneException("Already requested to join this trip");}
        joinRequestRepo.save(new JoinRequest(trip, user));
    }

    public List<InvitationSummary> getMyInvitations(UUID userId) {
        return invitationRepo.findByUserId(userId).stream().map(Invitation::toInvitationSummary).toList();
    }


    public void leaveTrip(UUID userId, UUID tripId){
        Trip trip=tripRepo.findById(tripId).orElseThrow(TripNotFoundException::new);
        User user=userRepo.findById(userId).orElseThrow(IllegalStateException::new);
        trip.assertIsMember(user);
        trip.getMembers().remove(user);
        tripRepo.save(trip);
        if(trip.getMembers().isEmpty()){
            tripRepo.delete(trip);
        }
    }

    public void resolveInvitation(UUID invitationId,UUID userId, @NotNull boolean accepted){
        Invitation invitation=invitationRepo.findById(invitationId).orElseThrow();
        Trip trip=invitation.getTrip();
        User user = userRepo.findById(userId).orElseThrow(IllegalStateException::new);
        trip.assertIsNotMember(invitation.getUser());
        if(!invitation.getUser().getId().equals(user.getId())){
            throw new AccessDeniedException("Only the invited user can accept or deny an invitation");
        }
        if(accepted){
            trip.getMembers().add(user);
        }
        invitationRepo.delete(invitation);
    }

    public void resolveJoinRequest(UUID requestId, UUID tripId, UUID userId, @NotNull Boolean accepted){
        JoinRequest request=joinRequestRepo.findById(requestId).orElseThrow(IllegalStateException::new);
        Trip trip=tripRepo.findById(tripId).orElseThrow(TripNotFoundException::new);
        User user=userRepo.findById(userId).orElseThrow(IllegalStateException::new);
        trip.assertIsMember(user);
        User invitedUser=request.getUser();
        trip.assertIsNotMember(invitedUser);
        if(accepted){
            trip.getMembers().add(invitedUser);
        }
        joinRequestRepo.delete(request);
    }
}

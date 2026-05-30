package gal.usc.telariabackend.services;


import gal.usc.telariabackend.model.JoinRequest;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.JoinRequestSummary;
import gal.usc.telariabackend.model.dto.TripDetail;
import gal.usc.telariabackend.model.dto.UserProfile;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.JoinRequestRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import gal.usc.telariabackend.model.dto.TripSummary;
import jakarta.transaction.Transactional;
import jakarta.validation.constraints.NotNull;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class TripService {
    private final TripRepository tripRepo;
    private final UserRepository userRepo;
    private final JoinRequestRepository joinRequestRepo;

    public TripService(TripRepository tripRepository,  UserRepository userRepo, JoinRequestRepository joinRequestRepo) {
        this.tripRepo = tripRepository;
        this.userRepo = userRepo;
        this.joinRequestRepo = joinRequestRepo;
    }


    @Transactional
    public UUID createTrip(@NotNull String tripname, UUID userId) {
        User owner = userRepo.findById(userId).orElseThrow();
        Trip trip = new Trip(tripname, owner);
        tripRepo.save(trip);
        return trip.getId();
    }

    @Transactional
    public List<TripSummary> listTrips(UUID userId) {
        return tripRepo.findAllByMembersId(userId).stream().map(Trip::toTripSummary).toList();
    }

    @Transactional
    public TripDetail getTripDetails(UUID tripId, UUID userId) {
        Trip trip=tripRepo.findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new);

        List<JoinRequestSummary> pendingRequests = joinRequestRepo.findAllByTrip(trip)
                .stream()
                .map(JoinRequest::toJoinRequestSummary)
                .toList();

        List<UserProfile> members = trip.getMembers()
                .stream()
                .map(User::toUserProfile)
                .toList();

        return new TripDetail()
                .id(trip.getId())
                .name(trip.getName())
                .members(members)
                .pendingRequests(pendingRequests);
    }
}

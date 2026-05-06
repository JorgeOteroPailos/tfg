package gal.usc.telariabackend.services;


import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import gal.usc.telariabackend.model.dto.TripSummary;
import jakarta.validation.constraints.NotNull;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class TripService {
    private final TripRepository tripRepo;
    private final UserRepository userRepo;

    public TripService(TripRepository tripRepository,  UserRepository userRepo) {
        this.tripRepo = tripRepository;
        this.userRepo = userRepo;
    }


    public UUID createTrip(@NotNull String tripname, UUID userId) {
        User owner = userRepo.findById(userId).orElseThrow();
        Trip trip = new Trip(tripname, owner);
        tripRepo.save(trip);
        return trip.getId();
    }

    public List<TripSummary> listTrips(UUID userId) {
        User u = userRepo.findById(userId).orElseThrow();
        List<Trip> list = tripRepo.findAllByMembersContaining(u);
        return list.stream().map(Trip::toTripSummary).toList();
    }
}

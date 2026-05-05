package gal.usc.telariabackend.Services;


import gal.usc.telariabackend.Model.Trip;
import gal.usc.telariabackend.Model.User;
import gal.usc.telariabackend.Repository.TripRepository;
import gal.usc.telariabackend.Repository.UserRepository;
import gal.usc.telariabackend.model.DTO.TripSummary;
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

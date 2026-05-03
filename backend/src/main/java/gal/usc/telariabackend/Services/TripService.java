package gal.usc.telariabackend.Services;


import gal.usc.telariabackend.Model.Trip;
import gal.usc.telariabackend.Model.User;
import gal.usc.telariabackend.Repository.TripRepository;
import gal.usc.telariabackend.Repository.UserRepository;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public class TripService {
    private final TripRepository tripRepo;
    private final UserRepository userRepo;

    public TripService(TripRepository tripRepository,  UserRepository userRepo) {
        this.tripRepo = tripRepository;
        this.userRepo = userRepo;
    }


    public UUID createTrip(@NotNull String tripname, String ownerEmail) {
        User owner = userRepo.findByEmail(ownerEmail).orElseThrow();
        Trip trip = new Trip(owner);
        tripRepo.save(trip);
        return UUID.randomUUID(); //TODO
    }
}

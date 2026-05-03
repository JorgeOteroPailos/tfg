package gal.usc.telariabackend.Controllers;

import gal.usc.telariabackend.Model.DTO.CreateTrip201Response;
import gal.usc.telariabackend.Model.DTO.CreateTripRequest;
import gal.usc.telariabackend.Services.TripService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class TripController implements TripsApi{
    private TripService tripService;

    @Override
    public ResponseEntity<CreateTrip201Response> createTrip(CreateTripRequest createTripRequest) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UUID id = tripService.createTrip(createTripRequest.getName(), auth.getName());
        CreateTrip201Response response = new CreateTrip201Response().id(id);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}

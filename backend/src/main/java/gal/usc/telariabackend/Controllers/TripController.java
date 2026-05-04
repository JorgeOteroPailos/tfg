package gal.usc.telariabackend.Controllers;

import gal.usc.telariabackend.Model.DTO.CreateTrip201Response;
import gal.usc.telariabackend.Model.DTO.CreateTripRequest;
import gal.usc.telariabackend.Services.TripService;
import gal.usc.telariabackend.utils.SecurityHelper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class TripController implements TripsApi{
    private final TripService tripService;

    private final SecurityHelper securityHelper;

    public  TripController(TripService tripService, SecurityHelper securityHelper) {this.tripService = tripService;
        this.securityHelper = securityHelper;
    }

    @Override
    public ResponseEntity<CreateTrip201Response> createTrip(CreateTripRequest createTripRequest) {
        UUID id = tripService.createTrip(createTripRequest.getName(), securityHelper.getUserId());
        CreateTrip201Response response = new CreateTrip201Response().id(id);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}

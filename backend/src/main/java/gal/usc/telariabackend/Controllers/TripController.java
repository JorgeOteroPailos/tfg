package gal.usc.telariabackend.Controllers;

import gal.usc.telariabackend.model.DTO.CreateTrip201Response;
import gal.usc.telariabackend.model.DTO.CreateTripRequest;
import gal.usc.telariabackend.model.DTO.TripDetail;
import gal.usc.telariabackend.model.DTO.TripSummary;
import gal.usc.telariabackend.Services.TripService;
import gal.usc.telariabackend.controllers.TripsApi;
import gal.usc.telariabackend.utils.SecurityHelper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class TripController implements TripsApi {
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

    @Override
    public ResponseEntity<List<TripSummary>> listTrips() {
        return ResponseEntity.status(HttpStatus.OK).body(tripService.listTrips(securityHelper.getUserId()));
    }


    @Override
    public ResponseEntity<TripDetail>  getTrip(UUID id) {
        return null; //todo
    }

}

package gal.usc.telariabackend.model.exceptions;

/**
 * Thrown when a user is not allowed to act on a trip, without revealing whether
 * the trip actually exists. Maps to HTTP 403 with a neutral message so that the
 * existence of a trip is not leaked to outsiders.
 */
public class TripAccessDeniedException extends RuntimeException {
    public TripAccessDeniedException(String message) {
        super(message);
    }

    public TripAccessDeniedException() {
        super("You don't have access to this trip");
    }
}

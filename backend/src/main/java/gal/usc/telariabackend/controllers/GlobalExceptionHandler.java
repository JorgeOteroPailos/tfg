package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.exceptions.AlreadyDoneException;
import gal.usc.telariabackend.model.exceptions.InvalidRefreshTokenException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.model.exceptions.TripNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.MvcUriComponentsBuilder;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {
    @ExceptionHandler(AlreadyDoneException.class)
    public ProblemDetail handle(AlreadyDoneException e){
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        error.setTitle("User already exists");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class).pathSegment("error","user-already-exists").build().toUri());
        error.setDetail(e.getMessage());
        return error;
    }

    @ExceptionHandler({BadCredentialsException.class, InternalAuthenticationServiceException.class})
    public ProblemDetail handleAuthErrors(Exception e) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        error.setTitle("Authentication failed");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class)
                .pathSegment("error", "authentication-failed").build().toUri());
        error.setDetail(e.getMessage());
        return error;
    }

    @ExceptionHandler(InvalidRefreshTokenException.class)
    public ProblemDetail handleInvalidRefreshToken(InvalidRefreshTokenException e) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        error.setTitle("Authentication failed");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class)
                .pathSegment("error", "authentication-failed").build().toUri());
        error.setDetail(e.getMessage());
        return error;
    }

    @ExceptionHandler(TripNotFoundException.class)
    public ProblemDetail handleTripNotFoundException(TripNotFoundException e) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        error.setTitle("Trip not found");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class)
                .pathSegment("error", "trip-not-found").build().toUri());
        error.setDetail(e.getMessage());
        return error;
    }


    @ExceptionHandler(NotATripMemberException.class)
    public ProblemDetail handleAccessDeniedException(NotATripMemberException e) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        error.setTitle("User doesn't belong to this trip");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class)
                .pathSegment("error", "doesnt-belong-to-trip").build().toUri());
        error.setDetail(e.getMessage());
        return error;
    }
}

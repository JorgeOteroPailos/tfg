package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.exceptions.AlreadyExistingUserException;
import gal.usc.telariabackend.model.exceptions.InvalidRefreshTokenException;
import gal.usc.telariabackend.model.exceptions.TripNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.MvcUriComponentsBuilder;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.nio.file.AccessDeniedException;

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {
    @ExceptionHandler(AlreadyExistingUserException.class)
    public ProblemDetail handle(AlreadyExistingUserException e){
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

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDeniedException(AccessDeniedException e) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        error.setTitle("USer doesn't belong to this trip");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class)
                .pathSegment("error", "doesnt-have-permission").build().toUri());
        error.setDetail(e.getMessage());
        return error;
    }
}

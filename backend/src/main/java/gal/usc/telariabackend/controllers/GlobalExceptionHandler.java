package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.exceptions.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.MvcUriComponentsBuilder;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.NoSuchElementException;

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {
    @ExceptionHandler(AlreadyDoneException.class)
    public ProblemDetail handle(AlreadyDoneException e){
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        error.setTitle("Conflict");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class).pathSegment("error","conflict").build().toUri());
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

    @ExceptionHandler(ExpenseNotFoundException.class)
    public ProblemDetail handleExpenseNotFoundException(ExpenseNotFoundException e) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        error.setTitle("Expense not found");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class)
                .pathSegment("error", "expense-not-found").build().toUri());
        error.setDetail(e.getMessage());
        return error;
    }


    @ExceptionHandler(EventNotFoundException.class)
    public ProblemDetail handleEventNotFoundException(EventNotFoundException e) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        error.setTitle("Event not found");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class)
                .pathSegment("error", "event-not-found").build().toUri());
        error.setDetail(e.getMessage());
        return error;
    }

    @ExceptionHandler(DocumentNotFoundException.class)
    public ProblemDetail handleEventNotFoundException(DocumentNotFoundException e) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        error.setTitle("Document not found");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class)
                .pathSegment("error", "document-not-found").build().toUri());
        error.setDetail(e.getMessage());
        return error;
    }

    @ExceptionHandler(InvalidLocationException.class)
    public ProblemDetail handleInvalidLocationException(InvalidLocationException e) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        error.setTitle("Invalid location");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class)
                .pathSegment("error", "invalid-location").build().toUri());
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

    @ExceptionHandler(NoSuchElementException.class)
    public ProblemDetail handleNoSuchElementException(NoSuchElementException e) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        error.setTitle("Element not found");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class)
                .pathSegment("error", "element-not-found").build().toUri());
        error.setDetail(e.getMessage());
        return error;
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException e) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        error.setTitle("Access denied");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class)
                .pathSegment("error", "access-denied").build().toUri());
        error.setDetail(e.getMessage());
        return error;
    }

    @ExceptionHandler(AvatarNotFoundException.class)
    public ProblemDetail handleAvatarNotFoundException(AvatarNotFoundException e) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        error.setTitle("Avatar not found");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class)
                .pathSegment("error", "avatar-not-found").build().toUri());
        error.setDetail(e.getMessage());
        return error;
    }

    @ExceptionHandler(DocumentNotFoundInStorageException.class)
    public ProblemDetail handle(DocumentNotFoundInStorageException e){
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        error.setTitle("Document not found in storage");
        error.setType(MvcUriComponentsBuilder.fromController(GlobalExceptionHandler.class)
                .pathSegment("error","document-not-found-in-storage").build().toUri());
        error.setDetail(e.getMessage());
        return error;
    }
}

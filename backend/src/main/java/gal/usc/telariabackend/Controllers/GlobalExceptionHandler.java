package gal.usc.telariabackend.Controllers;

import gal.usc.telariabackend.Model.Exceptions.AlreadyExistingUserException;
import gal.usc.telariabackend.Model.Exceptions.InvalidRefreshTokenException;
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
}

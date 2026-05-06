package gal.usc.telariabackend.model.exceptions;

public class AlreadyExistingUserException extends RuntimeException{
    public final String email;

    public AlreadyExistingUserException(String email) {
        super("A user with email \""+email+"\" already exists. Try loging in?");

        this.email = email;
    }
}

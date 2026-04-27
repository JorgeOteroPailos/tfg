package gal.usc.telariabackend.Model.Exceptions;

public class AlreadyExistingUserException extends RuntimeException{
    public final String email;

    public AlreadyExistingUserException(String email) {
        super("A user with email \""+email+"\" already exists. Try loging in?");

        this.email = email;
    }
}

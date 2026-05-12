package gal.usc.telariabackend.model.exceptions;

public class NotATripMemberException extends RuntimeException {
    public NotATripMemberException(String message) {
        super(message);
    }

    public NotATripMemberException() {
        super("User is not a member of this trip");
    }
}

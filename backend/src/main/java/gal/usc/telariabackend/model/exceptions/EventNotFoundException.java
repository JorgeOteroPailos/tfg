package gal.usc.telariabackend.model.exceptions;

public class EventNotFoundException extends RuntimeException {
    public EventNotFoundException(String message) {
        super(message);
    }
    public EventNotFoundException() { super("Event not found"); }
}

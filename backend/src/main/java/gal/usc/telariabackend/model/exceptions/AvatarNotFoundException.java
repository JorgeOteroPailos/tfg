package gal.usc.telariabackend.model.exceptions;

public class AvatarNotFoundException extends RuntimeException {
    public AvatarNotFoundException() {
        super("Avatar not found");
    }
}

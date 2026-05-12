package gal.usc.telariabackend.model.exceptions;

public class AlreadyDoneException extends RuntimeException{
    public  AlreadyDoneException(String message){
        super(message);
    }
}

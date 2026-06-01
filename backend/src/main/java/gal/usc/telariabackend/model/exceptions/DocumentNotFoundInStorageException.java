package gal.usc.telariabackend.model.exceptions;

public class DocumentNotFoundInStorageException extends RuntimeException {
    public DocumentNotFoundInStorageException() {
        super("Document not found in storage");
    }
}

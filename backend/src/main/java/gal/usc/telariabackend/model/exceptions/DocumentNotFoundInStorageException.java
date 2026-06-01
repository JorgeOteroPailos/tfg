package gal.usc.telariabackend.model.exceptions;

public class DocumentNotFoundInStorage extends RuntimeException {
    public DocumentNotFoundInStorage() {
        super("Document not found in storage");
    }
}

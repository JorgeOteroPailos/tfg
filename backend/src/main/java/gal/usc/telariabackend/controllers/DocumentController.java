package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.dto.DocumentDownloadResponse;
import gal.usc.telariabackend.model.dto.DocumentResponse;
import gal.usc.telariabackend.model.dto.DocumentUploadRequest;
import gal.usc.telariabackend.model.dto.DocumentUploadResponse;
import gal.usc.telariabackend.services.SharedDocumentService;
import gal.usc.telariabackend.utils.SecurityHelper;
import org.springdoc.core.service.SecurityService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
public class DocumentController implements DocumentsApi {

    private final SharedDocumentService documentService;
    private final SecurityHelper securityHelper;

    public DocumentController(SharedDocumentService documentService, SecurityHelper securityHelper) {
        this.documentService = documentService;
        this.securityHelper = securityHelper;
    }

    @Override
    public ResponseEntity<DocumentUploadResponse> initDocumentUpload(UUID tripId, DocumentUploadRequest documentUploadRequest) {
        UUID uploaderId = securityHelper.getUserId();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(documentService.initUpload(tripId, uploaderId, documentUploadRequest));
    }

    @Override
    public ResponseEntity<Void> confirmDocumentUpload(UUID tripId, UUID documentId) {
        documentService.confirmUpload(tripId, documentId);
        return ResponseEntity.ok().build();
    }

    @Override
    public ResponseEntity<List<DocumentResponse>> listDocuments(UUID tripId, LocalDate date, Integer tzOffsetMinutes) {
        UUID requesterId = securityHelper.getUserId();
        return ResponseEntity.ok(documentService.listDocuments(tripId, requesterId, date, tzOffsetMinutes));
    }

    @Override
    public ResponseEntity<DocumentDownloadResponse> getDocumentDownloadUrl(UUID tripId, UUID documentId) {
        return ResponseEntity.ok(documentService.getDownloadUrl(tripId, documentId, securityHelper.getUserId()));
    }

    @Override
    public ResponseEntity<Void> deleteDocument(UUID tripId, UUID documentId) {
        UUID requesterId = securityHelper.getUserId();
        documentService.deleteDocument(tripId, documentId, requesterId);
        return ResponseEntity.noContent().build();
    }
}

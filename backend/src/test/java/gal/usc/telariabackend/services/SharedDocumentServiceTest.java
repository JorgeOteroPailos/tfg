package gal.usc.telariabackend.services;

import gal.usc.telariabackend.configuration.ImageProperties;
import gal.usc.telariabackend.configuration.MinioConfig;
import gal.usc.telariabackend.model.SharedDocument;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.DocumentResponse;
import gal.usc.telariabackend.model.dto.DocumentUploadRequest;
import gal.usc.telariabackend.model.dto.DocumentUploadResponse;
import gal.usc.telariabackend.model.exceptions.DocumentNotFoundException;
import gal.usc.telariabackend.model.exceptions.DocumentNotFoundInStorageException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.SharedDocumentRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;

import java.net.URI;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SharedDocumentServiceTest {

    @Mock
    private SharedDocumentRepository documentRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private S3Client s3Client;

    @Mock
    private S3Presigner s3Presigner;

    @Mock
    private ImageService imageService;

    private MinioConfig minioConfig;

    private SharedDocumentService documentService;

    @BeforeEach
    void setUp() {
        minioConfig = new MinioConfig();
        minioConfig.setBucket("test-bucket");
        minioConfig.setPresignedUrlExpirationMinutes(15);

        documentService = new SharedDocumentService(documentRepository, tripRepository, userRepository,
                s3Client, s3Presigner, minioConfig, imageService, new ImageProperties());
    }

    private void stubPresignedPut() throws Exception {
        PresignedPutObjectRequest presigned = mock(PresignedPutObjectRequest.class);
        when(presigned.url()).thenReturn(URI.create("http://minio/test-bucket/put").toURL());
        when(s3Presigner.presignPutObject(any(PutObjectPresignRequest.class))).thenReturn(presigned);
    }

    private void stubPresignedGet() throws Exception {
        PresignedGetObjectRequest presigned = mock(PresignedGetObjectRequest.class);
        when(presigned.url()).thenReturn(URI.create("http://minio/test-bucket/get").toURL());
        when(s3Presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenReturn(presigned);
    }

    private void stubObjectBytesInStorage(byte[] bytes) {
        when(s3Client.getObjectAsBytes(any(GetObjectRequest.class)))
                .thenReturn(ResponseBytes.fromByteArray(GetObjectResponse.builder().build(), bytes));
    }

    // -------------------------------------------------------------------------
    // initUpload
    // -------------------------------------------------------------------------

    @Test
    void initUpload_WhenMember_ShouldPersistDocumentAndReturnPresignedUrl() throws Exception {
        UUID tripId = UUID.randomUUID();
        UUID uploaderId = UUID.randomUUID();
        Trip trip = mock(Trip.class);
        User uploader = new User("uploader", "up@test.com", "encoded-password", uploaderId);

        when(tripRepository.findById(tripId)).thenReturn(Optional.of(trip));
        when(userRepository.findById(uploaderId)).thenReturn(Optional.of(uploader));
        stubPresignedPut();

        DocumentUploadResponse result = documentService.initUpload(tripId, uploaderId,
                new DocumentUploadRequest().name("plan.pdf").contentType("application/pdf"));

        assertNotNull(result.getUploadUrl());

        ArgumentCaptor<SharedDocument> captor = ArgumentCaptor.forClass(SharedDocument.class);
        verify(documentRepository).save(captor.capture());
        SharedDocument saved = captor.getValue();
        assertEquals("plan.pdf", saved.getFileName());
        assertFalse(saved.isUploaded());
        assertTrue(saved.getObjectKey().startsWith(tripId.toString()));
    }

    @Test
    void initUpload_WhenNotMember_ShouldThrowAndNotPersist() {
        UUID tripId = UUID.randomUUID();
        UUID uploaderId = UUID.randomUUID();
        Trip trip = mock(Trip.class);
        User uploader = new User("uploader", "up@test.com", "encoded-password", uploaderId);

        when(tripRepository.findById(tripId)).thenReturn(Optional.of(trip));
        when(userRepository.findById(uploaderId)).thenReturn(Optional.of(uploader));
        doThrow(new NotATripMemberException()).when(trip).assertIsMember(uploader);

        assertThrows(NotATripMemberException.class, () -> documentService.initUpload(tripId, uploaderId,
                new DocumentUploadRequest().name("plan.pdf").contentType("application/pdf")));

        verify(documentRepository, never()).save(any());
        verifyNoInteractions(s3Presigner);
    }

    @Test
    void initUpload_WhenTripDoesNotExist_ShouldThrowNotATripMember() {
        UUID tripId = UUID.randomUUID();
        when(tripRepository.findById(tripId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class, () -> documentService.initUpload(tripId, UUID.randomUUID(),
                new DocumentUploadRequest().name("plan.pdf").contentType("application/pdf")));

        verify(documentRepository, never()).save(any());
    }

    // -------------------------------------------------------------------------
    // confirmUpload
    // -------------------------------------------------------------------------

    @Test
    void confirmUpload_WhenFileExistsInStorage_ShouldMarkUploadedAndSave() {
        UUID tripId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        SharedDocument document = mock(SharedDocument.class);
        when(document.getObjectKey()).thenReturn(tripId + "/key.pdf");

        when(documentRepository.findByIdAndTripId(documentId, tripId)).thenReturn(Optional.of(document));
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().build());

        documentService.confirmUpload(tripId, documentId);

        verify(document).confirmUpload();
        verify(documentRepository).save(document);
    }

    @Test
    void confirmUpload_WhenFileMissingFromStorage_ShouldThrowAndNotConfirm() {
        UUID tripId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        SharedDocument document = mock(SharedDocument.class);
        when(document.getObjectKey()).thenReturn(tripId + "/missing.pdf");

        when(documentRepository.findByIdAndTripId(documentId, tripId)).thenReturn(Optional.of(document));
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenThrow(NoSuchKeyException.builder().build());

        assertThrows(DocumentNotFoundInStorageException.class,
                () -> documentService.confirmUpload(tripId, documentId));

        verify(document, never()).confirmUpload();
        verify(documentRepository, never()).save(any());
    }

    @Test
    void confirmUpload_WhenDocumentNotFound_ShouldThrow() {
        UUID tripId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        when(documentRepository.findByIdAndTripId(documentId, tripId)).thenReturn(Optional.empty());

        assertThrows(DocumentNotFoundException.class,
                () -> documentService.confirmUpload(tripId, documentId));

        verifyNoInteractions(s3Client);
    }

    // -------------------------------------------------------------------------
    // listDocuments
    // -------------------------------------------------------------------------

    @Test
    void listDocuments_ShouldHideOtherUsersUnconfirmedUploadsButKeepOwn() {
        UUID tripId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        UUID strangerId = UUID.randomUUID();
        User requester = new User("me", "me@test.com", "encoded-password", requesterId);
        User stranger = new User("other", "other@test.com", "encoded-password", strangerId);
        Trip trip = mock(Trip.class);

        SharedDocument confirmedByStranger = new SharedDocument(trip, stranger, "shared.pdf", "k1", "application/pdf", true);
        SharedDocument pendingByStranger = new SharedDocument(trip, stranger, "ghost.pdf", "k2", "application/pdf", false);
        SharedDocument pendingByRequester = new SharedDocument(trip, requester, "mine.pdf", "k3", "application/pdf", false);

        when(tripRepository.findById(tripId)).thenReturn(Optional.of(trip));
        when(documentRepository.findByTripId(tripId))
                .thenReturn(List.of(confirmedByStranger, pendingByStranger, pendingByRequester));

        List<DocumentResponse> result = documentService.listDocuments(tripId, requesterId);

        assertEquals(2, result.size());
        List<String> names = result.stream().map(DocumentResponse::getName).toList();
        assertTrue(names.contains("shared.pdf"));
        assertTrue(names.contains("mine.pdf"));
        assertFalse(names.contains("ghost.pdf"));
    }

    @Test
    void listDocuments_WhenThumbnailPresent_ShouldAttachPreviewUrl() throws Exception {
        UUID tripId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        User requester = new User("me", "me@test.com", "encoded-password", requesterId);
        Trip trip = mock(Trip.class);

        SharedDocument withThumb = new SharedDocument(trip, requester, "photo.jpg", "k1", "image/jpeg", true);
        withThumb.setThumbnailObjectKey("k1.thumb.jpg");
        SharedDocument withoutThumb = new SharedDocument(trip, requester, "doc.pdf", "k2", "application/pdf", true);

        when(tripRepository.findById(tripId)).thenReturn(Optional.of(trip));
        when(documentRepository.findByTripId(tripId)).thenReturn(List.of(withThumb, withoutThumb));
        stubPresignedGet();

        List<DocumentResponse> result = documentService.listDocuments(tripId, requesterId);

        DocumentResponse photo = result.stream().filter(d -> d.getName().equals("photo.jpg")).findFirst().orElseThrow();
        DocumentResponse pdf = result.stream().filter(d -> d.getName().equals("doc.pdf")).findFirst().orElseThrow();
        assertNotNull(photo.getPreviewUrl());
        assertNull(pdf.getPreviewUrl());
    }

    @Test
    void listDocuments_WhenRequesterNotMember_ShouldThrow() {
        UUID tripId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        Trip trip = mock(Trip.class);

        when(tripRepository.findById(tripId)).thenReturn(Optional.of(trip));
        doThrow(new NotATripMemberException()).when(trip).assertIsMember(requesterId);

        assertThrows(NotATripMemberException.class, () -> documentService.listDocuments(tripId, requesterId));

        verify(documentRepository, never()).findByTripId(any());
    }

    // -------------------------------------------------------------------------
    // getDownloadUrl
    // -------------------------------------------------------------------------

    @Test
    void getDownloadUrl_WhenMember_ShouldReturnPresignedUrl() throws Exception {
        UUID tripId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        SharedDocument document = mock(SharedDocument.class);
        when(document.getObjectKey()).thenReturn("k1");

        when(documentRepository.findByIdAndTripId(documentId, tripId)).thenReturn(Optional.of(document));
        when(tripRepository.existsByIdAndMembersId(tripId, requesterId)).thenReturn(true);
        stubPresignedGet();

        assertNotNull(documentService.getDownloadUrl(tripId, documentId, requesterId).getDownloadUrl());
    }

    @Test
    void getDownloadUrl_WhenRequesterNotMember_ShouldThrow() {
        UUID tripId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        SharedDocument document = mock(SharedDocument.class);

        when(documentRepository.findByIdAndTripId(documentId, tripId)).thenReturn(Optional.of(document));
        when(tripRepository.existsByIdAndMembersId(tripId, requesterId)).thenReturn(false);

        assertThrows(NotATripMemberException.class,
                () -> documentService.getDownloadUrl(tripId, documentId, requesterId));

        verifyNoInteractions(s3Presigner);
    }

    @Test
    void getDownloadUrl_WhenDocumentNotFound_ShouldThrow() {
        UUID tripId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        when(documentRepository.findByIdAndTripId(documentId, tripId)).thenReturn(Optional.empty());

        assertThrows(DocumentNotFoundException.class,
                () -> documentService.getDownloadUrl(tripId, documentId, UUID.randomUUID()));
    }

    // -------------------------------------------------------------------------
    // deleteDocument
    // -------------------------------------------------------------------------

    @Test
    void deleteDocument_WhenCreator_ShouldRemoveObjectThumbnailAndRecord() {
        UUID tripId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        User creator = new User("owner", "owner@test.com", "encoded-password", requesterId);
        SharedDocument document = new SharedDocument(mock(Trip.class), creator, "doc.pdf", "k1", "application/pdf", true);
        document.setThumbnailObjectKey("k1.thumb.jpg");

        when(documentRepository.findByIdAndTripId(documentId, tripId)).thenReturn(Optional.of(document));

        documentService.deleteDocument(tripId, documentId, requesterId);

        ArgumentCaptor<DeleteObjectRequest> deleteCaptor = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client, times(2)).deleteObject(deleteCaptor.capture());
        List<String> deletedKeys = deleteCaptor.getAllValues().stream().map(DeleteObjectRequest::key).toList();
        assertTrue(deletedKeys.contains("k1"));
        assertTrue(deletedKeys.contains("k1.thumb.jpg"));
        verify(documentRepository).delete(document);
    }

    @Test
    void deleteDocument_WhenNotCreator_ShouldThrowAndNotDelete() {
        UUID tripId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        User creator = new User("owner", "owner@test.com", "encoded-password", UUID.randomUUID());
        SharedDocument document = new SharedDocument(mock(Trip.class), creator, "doc.pdf", "k1", "application/pdf", true);

        when(documentRepository.findByIdAndTripId(documentId, tripId)).thenReturn(Optional.of(document));

        assertThrows(AccessDeniedException.class,
                () -> documentService.deleteDocument(tripId, documentId, UUID.randomUUID()));

        verifyNoInteractions(s3Client);
        verify(documentRepository, never()).delete(any());
    }

    // -------------------------------------------------------------------------
    // bulk deletion
    // -------------------------------------------------------------------------

    @Test
    void deleteAllForTrip_ShouldRemoveEveryObjectAndAllRecords() {
        UUID tripId = UUID.randomUUID();
        User creator = new User("owner", "owner@test.com", "encoded-password", UUID.randomUUID());
        SharedDocument a = new SharedDocument(mock(Trip.class), creator, "a.pdf", "ka", "application/pdf", true);
        SharedDocument b = new SharedDocument(mock(Trip.class), creator, "b.jpg", "kb", "image/jpeg", true);
        b.setThumbnailObjectKey("kb.thumb.jpg");

        when(documentRepository.findByTripId(tripId)).thenReturn(List.of(a, b));

        documentService.deleteAllForTrip(tripId);

        verify(s3Client, times(3)).deleteObject(any(DeleteObjectRequest.class));
        verify(documentRepository).deleteAll(List.of(a, b));
    }

    @Test
    void deleteAllForUser_ShouldRemoveEveryObjectAndAllRecords() {
        UUID userId = UUID.randomUUID();
        User creator = new User("owner", "owner@test.com", "encoded-password", userId);
        SharedDocument a = new SharedDocument(mock(Trip.class), creator, "a.pdf", "ka", "application/pdf", true);

        when(documentRepository.findByCreatorId(userId)).thenReturn(List.of(a));

        documentService.deleteAllForUser(userId);

        verify(s3Client).deleteObject(any(DeleteObjectRequest.class));
        verify(documentRepository).deleteAll(List.of(a));
    }

    // -------------------------------------------------------------------------
    // backfillMissingThumbnails
    // -------------------------------------------------------------------------

    @Test
    void backfillMissingThumbnails_WhenImageDocument_ShouldGenerateThumbnailAndSave() {
        User creator = new User("owner", "owner@test.com", "encoded-password", UUID.randomUUID());
        SharedDocument image = new SharedDocument(mock(Trip.class), creator, "photo.jpg", "k1", "image/jpeg", true);

        when(documentRepository.findByUploadedTrueAndThumbnailObjectKeyIsNull()).thenReturn(List.of(image));
        when(imageService.isSupportedImage("image/jpeg", "photo.jpg")).thenReturn(true);
        stubObjectBytesInStorage(new byte[]{1, 2, 3});
        when(imageService.downscaleToJpeg(any(byte[].class), anyInt())).thenReturn(Optional.of(new byte[]{9, 9}));

        documentService.backfillMissingThumbnails();

        assertEquals("k1.thumb.jpg", image.getThumbnailObjectKey());
        verify(documentRepository).save(image);
    }

    @Test
    void backfillMissingThumbnails_WhenNotAnImage_ShouldSkipWithoutSaving() {
        User creator = new User("owner", "owner@test.com", "encoded-password", UUID.randomUUID());
        SharedDocument pdf = new SharedDocument(mock(Trip.class), creator, "doc.pdf", "k1", "application/pdf", true);

        when(documentRepository.findByUploadedTrueAndThumbnailObjectKeyIsNull()).thenReturn(List.of(pdf));
        when(imageService.isSupportedImage("application/pdf", "doc.pdf")).thenReturn(false);

        documentService.backfillMissingThumbnails();

        assertNull(pdf.getThumbnailObjectKey());
        verify(documentRepository, never()).save(any());
        verifyNoInteractions(s3Client);
    }
}

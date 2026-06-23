package gal.usc.telariabackend.services;

import gal.usc.telariabackend.configuration.ImageProperties;
import gal.usc.telariabackend.configuration.MinioConfig;
import gal.usc.telariabackend.model.SharedDocument;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.DocumentDownloadResponse;
import gal.usc.telariabackend.model.dto.DocumentResponse;
import gal.usc.telariabackend.model.dto.DocumentUploadRequest;
import gal.usc.telariabackend.model.dto.DocumentUploadResponse;
import gal.usc.telariabackend.model.exceptions.DocumentNotFoundException;
import gal.usc.telariabackend.model.exceptions.DocumentNotFoundInStorageException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.SharedDocumentRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class SharedDocumentService {

    private static final Logger log = LoggerFactory.getLogger(SharedDocumentService.class);

    private final SharedDocumentRepository documentRepository;
    private final TripRepository tripRepository;
    private final UserRepository userRepository;
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final MinioConfig minioConfig;
    private final ImageService imageService;
    private final ImageProperties imageProperties;
    private final ExecutorService thumbnailExecutor = Executors.newVirtualThreadPerTaskExecutor();

    public SharedDocumentService(SharedDocumentRepository documentRepository,
                                 TripRepository tripRepository,
                                 UserRepository userRepository,
                                 S3Client s3Client,
                                 S3Presigner s3Presigner,
                                 MinioConfig minioConfig,
                                 ImageService imageService,
                                 ImageProperties imageProperties) {
        this.documentRepository = documentRepository;
        this.tripRepository = tripRepository;
        this.userRepository = userRepository;
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.minioConfig = minioConfig;
        this.imageService = imageService;
        this.imageProperties = imageProperties;
    }

    public DocumentUploadResponse initUpload(UUID tripId, UUID uploaderId, DocumentUploadRequest request) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(NotATripMemberException::new);
        User uploader = userRepository.findById(uploaderId)
                .orElseThrow(IllegalStateException::new);

        trip.assertIsMember(uploader);

        String objectKey = tripId + "/" + UUID.randomUUID() + "-" + request.getName();

        SharedDocument document = new SharedDocument(trip, uploader, request.getName(), objectKey, request.getContentType(), false);
        documentRepository.save(document);

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(minioConfig.getPresignedUrlExpirationMinutes()))
                .putObjectRequest(PutObjectRequest.builder()
                        .bucket(minioConfig.getBucket())
                        .key(objectKey)
                        .build())
                .build();

        String uploadUrl = s3Presigner.presignPutObject(presignRequest).url().toString();

        return new DocumentUploadResponse().documentId(document.getId()).uploadUrl(uploadUrl);
    }

    public void confirmUpload(UUID tripId, UUID documentId) {
        SharedDocument document = documentRepository.findByIdAndTripId(documentId, tripId)
                .orElseThrow(DocumentNotFoundException::new);

        try {
            s3Client.headObject(HeadObjectRequest.builder()
                    .bucket(minioConfig.getBucket())
                    .key(document.getObjectKey())
                    .build());
        } catch (NoSuchKeyException e) {
            throw new DocumentNotFoundInStorageException();
        }

        document.confirmUpload();
        documentRepository.save(document);

        UUID id = document.getId();
        thumbnailExecutor.submit(() -> generateAndStoreThumbnail(id));
    }

    /**
     * Generates and persists the thumbnail for a single document off the request thread.
     * Reloads the entity by id (the caller's copy is detached once the request transaction
     * has committed) and saves only when a thumbnail was actually produced.
     */
    private void generateAndStoreThumbnail(UUID documentId) {
        try {
            documentRepository.findById(documentId).ifPresent(document -> {
                generateThumbnail(document);
                if (document.getThumbnailObjectKey() != null) {
                    documentRepository.save(document);
                }
            });
        } catch (Exception e) {
            log.warn("Async thumbnail generation failed for document {}: {}", documentId, e.getMessage());
        }
    }

    /**
     * Produces the downscaled JPEG, uploads it to storage and sets {@code thumbnailObjectKey}
     * on the entity. Does not persist-> the caller is responsible for saving.
     */
    private void generateThumbnail(SharedDocument document) {
        if (!imageService.isSupportedImage(document.getContentType(), document.getFileName())) {
            return;
        }
        try {
            byte[] original = s3Client.getObjectAsBytes(GetObjectRequest.builder()
                    .bucket(minioConfig.getBucket())
                    .key(document.getObjectKey())
                    .build()).asByteArray();

            imageService.downscaleToJpeg(original, imageProperties.getThumbnailMaxDimension())
                    .ifPresent(thumb -> {
                        String thumbKey = document.getObjectKey() + ".thumb.jpg";
                        s3Client.putObject(PutObjectRequest.builder()
                                        .bucket(minioConfig.getBucket())
                                        .key(thumbKey)
                                        .contentType("image/jpeg")
                                        .build(),
                                RequestBody.fromBytes(thumb));
                        document.setThumbnailObjectKey(thumbKey);
                    });
        } catch (Exception e) {
            log.warn("Thumbnail generation failed for document {}: {}", document.getId(), e.getMessage());
        }
    }

    public List<DocumentResponse> listDocuments(UUID tripId, UUID requesterId) {
        return listDocuments(tripId, requesterId, null, null);
    }

    public List<DocumentResponse> listDocuments(UUID tripId, UUID requesterId, LocalDate date) {
        return listDocuments(tripId, requesterId, date, null);
    }

    public List<DocumentResponse> listDocuments(UUID tripId, UUID requesterId, LocalDate date, Integer tzOffsetMinutes) {
        Trip t=tripRepository.findById(tripId)
                .orElseThrow(NotATripMemberException::new);

        t.assertIsMember(requesterId);

        List<SharedDocument> source;
        if (date != null) {
            // tzOffsetMinutes follows JS Date.getTimezoneOffset() (minutes to add to local
            // to reach UTC), so the client's zone offset is its negation.
            ZoneOffset zone = tzOffsetMinutes != null
                    ? ZoneOffset.ofTotalSeconds(-tzOffsetMinutes * 60)
                    : ZoneOffset.UTC;
            OffsetDateTime start = date.atStartOfDay().atOffset(zone);
            OffsetDateTime end = date.plusDays(1).atStartOfDay().atOffset(zone);
            source = documentRepository.findByTripIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(tripId, start, end);
        } else {
            source = documentRepository.findByTripId(tripId);
        }

        List<SharedDocument> docs = source.stream()
                .filter(d -> d.isUploaded() || d.getCreator().getId().equals(requesterId))
                .toList();

        return docs.stream()
                .map(d -> {
                    DocumentResponse response = d.toDocumentResponse();
                    if (d.getThumbnailObjectKey() != null) {
                        response.previewUrl(presignGet(d.getThumbnailObjectKey()));
                    }
                    return response;
                })
                .toList();
    }

    /**
     * Generates thumbnails for uploaded image documents that don't have one yet. Runs off the
     * request path (see {@code ThumbnailBackfillScheduler}) so listing stays read-only.
     */
    public void backfillMissingThumbnails() {
        List<SharedDocument> docs = documentRepository.findByUploadedTrueAndThumbnailObjectKeyIsNull();
        for (SharedDocument doc : docs) {
            generateThumbnail(doc);
            if (doc.getThumbnailObjectKey() != null) {
                documentRepository.save(doc);
            }
        }
    }

    private String presignGet(String objectKey) {
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(minioConfig.getPresignedUrlExpirationMinutes()))
                .getObjectRequest(GetObjectRequest.builder()
                        .bucket(minioConfig.getBucket())
                        .key(objectKey)
                        .build())
                .build();
        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    public DocumentDownloadResponse getDownloadUrl(UUID tripId, UUID documentId, UUID requesterId) {
        SharedDocument document = documentRepository.findByIdAndTripId(documentId, tripId)
                .orElseThrow(DocumentNotFoundException::new);
        if(!tripRepository.existsByIdAndMembersId(tripId, requesterId)){
            throw new NotATripMemberException();
        }

        return new DocumentDownloadResponse().downloadUrl(presignGet(document.getObjectKey()));
    }

    public void deleteAllForTrip(UUID tripId) {
        List<SharedDocument> docs = documentRepository.findByTripId(tripId);
        for (SharedDocument doc : docs) {
            try {
                s3Client.deleteObject(DeleteObjectRequest.builder()
                        .bucket(minioConfig.getBucket())
                        .key(doc.getObjectKey())
                        .build());
            } catch (Exception e) {
                log.warn("Failed to delete S3 object '{}' for trip {}: {}", doc.getObjectKey(), tripId, e.getMessage());
            }
            deleteThumbnail(doc);
        }
        documentRepository.deleteAll(docs);
    }

    /**
     * Deletes every document uploaded by the given user (across all trips), removing the
     * stored object and thumbnail from Minio. Used when a user deletes their account.
     */
    public void deleteAllForUser(UUID userId) {
        List<SharedDocument> docs = documentRepository.findByCreatorId(userId);
        for (SharedDocument doc : docs) {
            try {
                s3Client.deleteObject(DeleteObjectRequest.builder()
                        .bucket(minioConfig.getBucket())
                        .key(doc.getObjectKey())
                        .build());
            } catch (Exception e) {
                log.warn("Failed to delete S3 object '{}' for user {}: {}", doc.getObjectKey(), userId, e.getMessage());
            }
            deleteThumbnail(doc);
        }
        documentRepository.deleteAll(docs);
    }

    public void deleteDocument(UUID tripId, UUID documentId, UUID requesterId) {
        SharedDocument document = documentRepository.findByIdAndTripId(documentId, tripId)
                .orElseThrow(DocumentNotFoundException::new);

        if (!document.getCreator().getId().equals(requesterId)) {
            throw new AccessDeniedException("Only the uploader can delete a document");
        }

        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(minioConfig.getBucket())
                .key(document.getObjectKey())
                .build());

        deleteThumbnail(document);

        documentRepository.delete(document);
    }

    private void deleteThumbnail(SharedDocument document) {
        if (document.getThumbnailObjectKey() == null) {
            return;
        }
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(minioConfig.getBucket())
                    .key(document.getThumbnailObjectKey())
                    .build());
        } catch (Exception e) {
            log.warn("Failed to delete thumbnail '{}' for document {}: {}",
                    document.getThumbnailObjectKey(), document.getId(), e.getMessage());
        }
    }


}
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
import java.util.List;
import java.util.UUID;

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
        generateThumbnail(document);
        documentRepository.save(document);
    }

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
        Trip t=tripRepository.findById(tripId)
                .orElseThrow(NotATripMemberException::new);

        t.assertIsMember(requesterId);

        return documentRepository.findByTripId(tripId).stream()
                .filter(d -> d.isUploaded() || d.getCreator().getId().equals(requesterId))
                .map(d -> {
                    DocumentResponse response = d.toDocumentResponse();
                    if (d.getThumbnailObjectKey() != null) {
                        response.previewUrl(presignGet(d.getThumbnailObjectKey()));
                    }
                    return response;
                })
                .toList();
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
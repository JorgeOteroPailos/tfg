package gal.usc.telariabackend.schedullers;

import gal.usc.telariabackend.configuration.MinioConfig;
import gal.usc.telariabackend.model.SharedDocument;
import gal.usc.telariabackend.repository.SharedDocumentRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

import java.time.OffsetDateTime;
import java.util.List;

@Component
public class OrphanDocumentCleanupScheduler {

    private final SharedDocumentRepository documentRepository;
    private final S3Client s3Client;
    private final MinioConfig minioConfig;

    public OrphanDocumentCleanupScheduler(SharedDocumentRepository documentRepository,
                                          S3Client s3Client,
                                          MinioConfig minioConfig) {
        this.documentRepository = documentRepository;
        this.s3Client = s3Client;
        this.minioConfig = minioConfig;
    }

    @Scheduled(fixedDelay = 300_000)
    public void cleanupOrphanDocuments() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusMinutes(30);
        List<SharedDocument> orphans = documentRepository.findByUploadedFalseAndCreatedAtBefore(cutoff);

        for (SharedDocument doc : orphans) {
            try {
                s3Client.headObject(HeadObjectRequest.builder()
                        .bucket(minioConfig.getBucket())
                        .key(doc.getObjectKey())
                        .build());
                doc.confirmUpload();
                documentRepository.save(doc);
            } catch (NoSuchKeyException e) {
                documentRepository.delete(doc);
            }
        }
    }
}

package gal.usc.telariabackend.schedullers;

import gal.usc.telariabackend.configuration.MinioConfig;
import gal.usc.telariabackend.model.SharedDocument;
import gal.usc.telariabackend.repository.SharedDocumentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

import java.time.OffsetDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrphanDocumentCleanupSchedulerTest {

    @Mock
    private SharedDocumentRepository documentRepository;

    @Mock
    private S3Client s3Client;

    @Mock
    private MinioConfig minioConfig;

    private OrphanDocumentCleanupScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new OrphanDocumentCleanupScheduler(documentRepository, s3Client, minioConfig);
    }

    @Test
    void cleanupOrphanDocuments_WhenDocumentExistsInMinio_ShouldConfirmUpload() {
        SharedDocument orphan = mock(SharedDocument.class);
        when(orphan.getObjectKey()).thenReturn("trip-id/some-file.pdf");
        when(documentRepository.findByUploadedFalseAndCreatedAtBefore(any(OffsetDateTime.class)))
                .thenReturn(List.of(orphan));
        when(minioConfig.getBucket()).thenReturn("test-bucket");
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().build());

        scheduler.cleanupOrphanDocuments();

        verify(orphan).confirmUpload();
        verify(documentRepository).save(orphan);
        verify(documentRepository, never()).delete(any(SharedDocument.class));
    }

    @Test
    void cleanupOrphanDocuments_WhenDocumentMissingFromMinio_ShouldDeleteRecord() {
        SharedDocument orphan = mock(SharedDocument.class);
        when(orphan.getObjectKey()).thenReturn("trip-id/missing-file.pdf");
        when(documentRepository.findByUploadedFalseAndCreatedAtBefore(any(OffsetDateTime.class)))
                .thenReturn(List.of(orphan));
        when(minioConfig.getBucket()).thenReturn("test-bucket");
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenThrow(NoSuchKeyException.builder().message("Not Found").build());

        scheduler.cleanupOrphanDocuments();

        verify(documentRepository).delete(orphan);
        verify(orphan, never()).confirmUpload();
        verify(documentRepository, never()).save(any(SharedDocument.class));
    }

    @Test
    void cleanupOrphanDocuments_WhenNoOrphansFound_ShouldDoNothing() {
        when(documentRepository.findByUploadedFalseAndCreatedAtBefore(any(OffsetDateTime.class)))
                .thenReturn(List.of());

        scheduler.cleanupOrphanDocuments();

        verifyNoInteractions(s3Client);
        verify(documentRepository, never()).save(any());
        verify(documentRepository, never()).delete(any());
    }
}

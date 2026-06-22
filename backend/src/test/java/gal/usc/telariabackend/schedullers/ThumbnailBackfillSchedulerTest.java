package gal.usc.telariabackend.schedullers;

import gal.usc.telariabackend.services.SharedDocumentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ThumbnailBackfillSchedulerTest {

    @Mock
    private SharedDocumentService documentService;

    private ThumbnailBackfillScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new ThumbnailBackfillScheduler(documentService);
    }

    @Test
    void backfillThumbnails_ShouldDelegateToDocumentService() {
        scheduler.backfillThumbnails();

        verify(documentService).backfillMissingThumbnails();
        verifyNoMoreInteractions(documentService);
    }
}

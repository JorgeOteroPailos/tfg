package gal.usc.telariabackend.schedullers;

import gal.usc.telariabackend.services.SharedDocumentService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ThumbnailBackfillScheduler {

    private final SharedDocumentService documentService;

    public ThumbnailBackfillScheduler(SharedDocumentService documentService) {
        this.documentService = documentService;
    }

    @Scheduled(fixedDelayString = "${scheduling.thumbnail-backfill-delay-ms}")
    public void backfillThumbnails() {
        documentService.backfillMissingThumbnails();
    }
}

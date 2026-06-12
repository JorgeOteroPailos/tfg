package gal.usc.telariabackend.model;

import gal.usc.telariabackend.model.dto.DocumentResponse;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "documents")
public class SharedDocument {

    @Getter
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Getter
    @ManyToOne(optional = false)
    @JoinColumn(name = "trip_id")
    private Trip trip;

    @Getter
    @ManyToOne(optional = false)
    @JoinColumn(name = "creator_id")
    private User creator;

    @Getter
    private String fileName;

    @Getter
    private String objectKey;

    @Getter
    private String contentType;

    @Getter
    @Setter
    private String thumbnailObjectKey;

    @Getter
    private OffsetDateTime createdAt;

    @Getter
    private boolean uploaded;

    public SharedDocument() {}

    public SharedDocument(Trip trip, User creator, String fileName, String objectKey, String contentType, boolean uploaded) {
        this.trip = trip;
        this.creator = creator;
        this.fileName = fileName;
        this.objectKey = objectKey;
        this.contentType = contentType;
        this.createdAt = OffsetDateTime.now();
        this.uploaded = uploaded;
    }

    public DocumentResponse toDocumentResponse() {
        return new DocumentResponse()
                .id(id)
                .name(fileName)
                .uploaderId(creator.getId())
                .uploadedAt(createdAt);
    }

    public void confirmUpload() {
        this.uploaded = true;
    }
}
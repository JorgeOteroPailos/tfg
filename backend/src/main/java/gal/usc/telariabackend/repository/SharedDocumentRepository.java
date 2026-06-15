package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.SharedDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SharedDocumentRepository extends JpaRepository<SharedDocument, UUID> {

    List<SharedDocument> findByTripId(UUID tripId);

    List<SharedDocument> findByCreatorId(UUID creatorId);

    Optional<SharedDocument> findByIdAndTripId(UUID id, UUID tripId);

    void deleteAllByTripId(UUID tripId);

    List<SharedDocument> findByUploadedFalseAndCreatedAtBefore(OffsetDateTime cutoff);
}

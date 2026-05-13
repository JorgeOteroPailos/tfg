package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.Invitation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InvitationRepository extends JpaRepository<Invitation, UUID> {
    List<Invitation> findByUserId(UUID user_id);
}

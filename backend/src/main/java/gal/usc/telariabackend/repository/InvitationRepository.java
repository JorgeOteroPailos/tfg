package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.Invitation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface InvitationRepository extends JpaRepository<Invitation, UUID> {
}

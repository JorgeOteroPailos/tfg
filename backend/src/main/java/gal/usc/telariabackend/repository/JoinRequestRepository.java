package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.JoinRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface JoinRequestRepository extends JpaRepository<JoinRequest, UUID> {
}

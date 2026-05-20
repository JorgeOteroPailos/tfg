package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.Settlement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SettlementRepository extends JpaRepository<Settlement, UUID>{
}

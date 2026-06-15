package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.Settlement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SettlementRepository extends JpaRepository<Settlement, UUID>{
    List<Settlement> findByTrip_IdOrderByTimestampDesc(UUID tripId);

    List<Settlement> findByTripId(UUID tripId);
}

package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;
import java.util.Optional;


public interface ExpenseRepository extends JpaRepository<Expense, UUID> {

    Optional<Expense> findByIdAndTripId(UUID expenseId, UUID tripId);

    List<Expense> findByTripId(UUID tripId);
}

package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;


public interface ExpenseRepository extends JpaRepository<Expense, UUID> {


}

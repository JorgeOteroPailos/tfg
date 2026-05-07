package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.dto.CreateExpenseRequest;
import gal.usc.telariabackend.model.dto.CreateTrip201Response;
import gal.usc.telariabackend.model.dto.ExpenseSummary;
import gal.usc.telariabackend.model.dto.Settlement;
import gal.usc.telariabackend.services.ExpenseService;
import gal.usc.telariabackend.services.TripService;
import gal.usc.telariabackend.utils.SecurityHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class ExpenseController implements ExpensesApi{
    private final ExpenseService expenseService;

    private final SecurityHelper securityHelper;

    public ExpenseController(ExpenseService expenseService, SecurityHelper securityHelper) {this.expenseService = expenseService;
        this.securityHelper = securityHelper;
    }

    @Override
    public ResponseEntity<CreateTrip201Response> createExpense(UUID id, CreateExpenseRequest createExpenseRequest) {
        //UUID id=ExpenseService.createExpense
        return ExpensesApi.super.createExpense(id, createExpenseRequest);
    }

    @Override
    public ResponseEntity<Void> deleteExpense(UUID id, UUID expenseId) {
        return ExpensesApi.super.deleteExpense(id, expenseId);
    }

    @Override
    public ResponseEntity<List<Settlement>> getBalances(UUID id) {
        return ExpensesApi.super.getBalances(id);
    }

    @Override
    public ResponseEntity<List<ExpenseSummary>> listExpenses(UUID id) {
        return ExpensesApi.super.listExpenses(id);
    }
}

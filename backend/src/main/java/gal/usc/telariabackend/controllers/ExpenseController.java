package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.dto.*;
import gal.usc.telariabackend.services.ExpenseService;
import gal.usc.telariabackend.utils.SecurityHelper;
import org.springframework.http.HttpStatus;
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
    public ResponseEntity<IdResponse> createExpense(UUID tripId, CreateExpenseRequest createExpenseRequest) {
        IdResponse response=new IdResponse().id(expenseService.createExpense(tripId, securityHelper.getUserId(), createExpenseRequest));
        return new  ResponseEntity<>(response, HttpStatus.OK);
    }

    @Override
    public ResponseEntity<Void> deleteExpense(UUID tripId, UUID expenseId) {
        expenseService.deleteExpense(tripId, expenseId, securityHelper.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    @Override
    public ResponseEntity<BalancesInfo> getBalances(UUID tripId) {
        return new ResponseEntity<>(expenseService.getBalances(tripId, securityHelper.getUserId()), HttpStatus.OK);
    }

    @Override
    public ResponseEntity<List<ExpenseSummary>> listExpenses(UUID tripId) {
        List<ExpenseSummary> response=expenseService.listExpenses(tripId, securityHelper.getUserId());
        return new ResponseEntity<>(response, HttpStatus.OK);
    }
}

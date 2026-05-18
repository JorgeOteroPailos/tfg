package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.Expense;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.*;
import gal.usc.telariabackend.model.exceptions.ExpenseNotFoundException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.ExpenseRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpenseServiceTest {

    @Mock
    private TripRepository tripRepo;
    @Mock
    private UserRepository userRepo;
    @Mock
    private ExpenseRepository expenseRepo;

    private ExpenseService expenseService;

    private UUID userId;
    private UUID tripId;
    private User user;

    @BeforeEach
    void setUp() {
        expenseService = new ExpenseService(tripRepo, userRepo, expenseRepo);
        userId = UUID.randomUUID();
        tripId = UUID.randomUUID();
        user = new User("pepe", "pepe@example.com", "encoded", userId);
    }

    // createExpense

    @Test
    void createExpense_WhenValid_ShouldSaveExpenseWithCorrectData() {
        User payer = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        User beneficiary = new User("lola", "lola@test.com", "encoded", UUID.randomUUID());
        Trip trip = new Trip("Viaje a Roma", user);
        trip.getMembers().add(payer);
        trip.getMembers().add(beneficiary);

        CreateExpenseRequest request = new CreateExpenseRequest()
                .amount(90.0)
                .description("Cena")
                .payerId(payer.getId())
                .beneficiaryIds(List.of(payer.getId(), beneficiary.getId()));

        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        when(tripRepo.findByIdAndMembersContaining(tripId, user)).thenReturn(Optional.of(trip));
        when(userRepo.getReferenceById(payer.getId())).thenReturn(payer);
        when(userRepo.getReferenceById(beneficiary.getId())).thenReturn(beneficiary);

        expenseService.createExpense(tripId, userId, request);

        ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
        verify(expenseRepo).save(captor.capture());
        assertEquals(BigDecimal.valueOf(90.0), captor.getValue().getAmount());
        assertEquals(payer, captor.getValue().getPayer());
    }

    @Test
    void createExpense_WhenCreatorIsNotMember_ShouldThrowAndNotSave() {
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        when(tripRepo.findByIdAndMembersContaining(tripId, user)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class,
                () -> expenseService.createExpense(tripId, userId, new CreateExpenseRequest()
                        .amount(10.0).description("x").payerId(userId).beneficiaryIds(List.of(userId))));

        verifyNoInteractions(expenseRepo);
    }

    @Test
    void createExpense_WhenPayerIsNotMember_ShouldThrowAndNotSave() {
        UUID strangerId = UUID.randomUUID();
        Trip trip = new Trip("Viaje", user);

        CreateExpenseRequest request = new CreateExpenseRequest()
                .amount(10.0)
                .description("x")
                .payerId(strangerId)
                .beneficiaryIds(List.of(userId));

        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        when(tripRepo.findByIdAndMembersContaining(tripId, user)).thenReturn(Optional.of(trip));

        assertThrows(NotATripMemberException.class,
                () -> expenseService.createExpense(tripId, userId, request));

        verifyNoInteractions(expenseRepo);
    }

    @Test
    void createExpense_WhenBeneficiaryIsNotMember_ShouldThrowAndNotSave() {
        UUID strangerId = UUID.randomUUID();
        Trip trip = new Trip("Viaje", user);

        CreateExpenseRequest request = new CreateExpenseRequest()
                .amount(10.0)
                .description("x")
                .payerId(userId)
                .beneficiaryIds(List.of(userId, strangerId));

        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        when(tripRepo.findByIdAndMembersContaining(tripId, user)).thenReturn(Optional.of(trip));

        assertThrows(NotATripMemberException.class,
                () -> expenseService.createExpense(tripId, userId, request));

        verifyNoInteractions(expenseRepo);
    }

    // deleteExpense

    @Test
    void deleteExpense_WhenUserIsMemberAndExpenseBelongsToTrip_ShouldDelete() {
        Trip trip = mock(Trip.class);
        Expense expense = mock(Expense.class);
        UUID expenseId = UUID.randomUUID();

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(expenseRepo.findById(expenseId)).thenReturn(Optional.of(expense));
        when(expense.getTrip()).thenReturn(trip);
        when(trip.getId()).thenReturn(tripId);

        expenseService.deleteExpense(tripId, expenseId, userId);

        verify(expenseRepo).deleteById(expenseId);
    }

    @Test
    void deleteExpense_WhenUserIsNotMember_ShouldThrowAndNotDelete() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class,
                () -> expenseService.deleteExpense(tripId, UUID.randomUUID(), userId));

        verify(expenseRepo, never()).deleteById(any());
    }

    @Test
    void deleteExpense_WhenExpenseDoesNotExist_ShouldThrowAndNotDelete() {
        UUID expenseId = UUID.randomUUID();
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(mock(Trip.class)));
        when(expenseRepo.findById(expenseId)).thenReturn(Optional.empty());

        assertThrows(ExpenseNotFoundException.class,
                () -> expenseService.deleteExpense(tripId, expenseId, userId));

        verify(expenseRepo, never()).deleteById(any());
    }

    @Test
    void deleteExpense_WhenExpenseBelongsToAnotherTrip_ShouldThrowAndNotDelete() {
        UUID expenseId = UUID.randomUUID();
        Trip trip = mock(Trip.class);
        Trip otherTrip = mock(Trip.class);
        Expense expense = mock(Expense.class);

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(expenseRepo.findById(expenseId)).thenReturn(Optional.of(expense));
        when(expense.getTrip()).thenReturn(otherTrip);
        when(otherTrip.getId()).thenReturn(UUID.randomUUID());

        assertThrows(NotATripMemberException.class,
                () -> expenseService.deleteExpense(tripId, expenseId, userId));

        verify(expenseRepo, never()).deleteById(any());
    }

    // listExpenses

    @Test
    void listExpenses_WhenUserIsMember_ShouldReturnExpenseSummaries() {
        Trip trip = mock(Trip.class);
        Expense e1 = mock(Expense.class);
        Expense e2 = mock(Expense.class);
        ExpenseSummary s1 = mock(ExpenseSummary.class);
        ExpenseSummary s2 = mock(ExpenseSummary.class);

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of(e1, e2));
        when(e1.toExpenseSummary()).thenReturn(s1);
        when(e2.toExpenseSummary()).thenReturn(s2);

        List<ExpenseSummary> result = expenseService.listExpenses(tripId, userId);

        assertEquals(2, result.size());
        assertTrue(result.containsAll(List.of(s1, s2)));
    }

    @Test
    void listExpenses_WhenUserIsNotMember_ShouldThrow() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class,
                () -> expenseService.listExpenses(tripId, userId));
    }

    // getBalances — algoritmo

    @Test
    void getBalances_WhenNoExpenses_ShouldReturnEmptySettlementsAndBalances() {
        Trip trip = mock(Trip.class);
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of());

        BalancesInfo result = expenseService.getBalances(tripId, userId);

        assertTrue(result.getSettlements().isEmpty());
        assertTrue(result.getBalances().isEmpty());
    }

    @Test
    void getBalances_WhenOnePayerAndOneBeneficiary_ShouldReturnOneSettlement() {
        User manolo = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        Trip trip = mock(Trip.class);

        Expense expense = new Expense(trip, user, BigDecimal.valueOf(30), "Cena", user, Set.of(user, manolo));

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of(expense));

        BalancesInfo result = expenseService.getBalances(tripId, userId);

        assertEquals(1, result.getSettlements().size());
        Settlement firstSettlement = result.getSettlements().stream()
                .findFirst().orElseThrow();
        assertEquals(Double.valueOf(15.0), firstSettlement.getAmount());
    }

    @Test
    void getBalances_WhenOnePayerAndOneBeneficiary_ShouldReturnCorrectBalances() {
        User manolo = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        Trip trip = mock(Trip.class);

        Expense expense = new Expense(trip, user, BigDecimal.valueOf(30), "Cena", user, Set.of(user, manolo));

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of(expense));

        BalancesInfo result = expenseService.getBalances(tripId, userId);

        UserBalance payerBalance = result.getBalances().stream()
                .filter(b -> user.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(Double.valueOf(15.0), payerBalance.getAmount());

        UserBalance debtorBalance = result.getBalances().stream()
                .filter(b -> manolo.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(Double.valueOf(-15.0), debtorBalance.getAmount());
    }

    @Test
    void getBalances_WhenPayerIsAlsoBeneficiary_ShouldNotCountPayerDebt() {
        User manolo = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        User lola = new User("lola", "lola@test.com", "encoded", UUID.randomUUID());
        Trip trip = mock(Trip.class);

        Expense expense = new Expense(trip, user, BigDecimal.valueOf(90), "Cena", user, Set.of(user, manolo, lola));

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of(expense));

        BalancesInfo result = expenseService.getBalances(tripId, userId);

        double totalSettled = result.getSettlements().stream().mapToDouble(Settlement::getAmount).sum();
        assertEquals(60.0, totalSettled, 0.01);

        UserBalance payerBalance = result.getBalances().stream()
                .filter(b -> user.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(Double.valueOf(60.0), payerBalance.getAmount());
    }

    @Test
    void getBalances_WhenMultipleExpenses_ShouldMinimizeSettlements() {
        User manolo = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        User lola = new User("lola", "lola@test.com", "encoded", UUID.randomUUID());
        Trip trip = mock(Trip.class);

        Expense e1 = new Expense(trip, user, BigDecimal.valueOf(90), "Cena", user, Set.of(user, manolo, lola));
        Expense e2 = new Expense(trip, manolo, BigDecimal.valueOf(60), "Hotel", manolo, Set.of(user, manolo, lola));

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of(e1, e2));

        BalancesInfo result = expenseService.getBalances(tripId, userId);

        assertEquals(2, result.getSettlements().size());
        double totalSettled = result.getSettlements().stream().mapToDouble(Settlement::getAmount).sum();
        assertEquals(50.0, totalSettled, 0.01);
    }

    @Test
    void getBalances_WhenMultipleExpenses_ShouldReturnCorrectBalances() {
        User manolo = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        User lola = new User("lola", "lola@test.com", "encoded", UUID.randomUUID());
        Trip trip = mock(Trip.class);

        Expense e1 = new Expense(trip, user, BigDecimal.valueOf(90), "Cena", user, Set.of(user, manolo, lola));
        Expense e2 = new Expense(trip, manolo, BigDecimal.valueOf(60), "Hotel", manolo, Set.of(user, manolo, lola));

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of(e1, e2));

        BalancesInfo result = expenseService.getBalances(tripId, userId);

        UserBalance pepeBalance = result.getBalances().stream()
                .filter(b -> user.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(Double.valueOf(40.0), pepeBalance.getAmount());

        UserBalance manoloBalance = result.getBalances().stream()
                .filter(b -> manolo.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(Double.valueOf(10.0), manoloBalance.getAmount());

        UserBalance lolaBalance = result.getBalances().stream()
                .filter(b -> lola.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(Double.valueOf(-50.0), lolaBalance.getAmount());
    }

    @Test
    void getBalances_WhenBalancesAreAlreadyEven_ShouldReturnNoSettlements() {
        User manolo = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        Trip trip = mock(Trip.class);

        Expense e1 = new Expense(trip, user, BigDecimal.valueOf(30), "Cena", user, Set.of(user, manolo));
        Expense e2 = new Expense(trip, manolo, BigDecimal.valueOf(30), "Hotel", manolo, Set.of(user, manolo));

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of(e1, e2));

        BalancesInfo result = expenseService.getBalances(tripId, userId);

        assertTrue(result.getSettlements().isEmpty());
        result.getBalances().forEach(b -> assertEquals(Double.valueOf(0.0), b.getAmount()));
    }

    @Test
    void getBalances_WhenUserIsNotMember_ShouldThrow() {
        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.empty());

        assertThrows(NotATripMemberException.class,
                () -> expenseService.getBalances(tripId, userId));
    }
}
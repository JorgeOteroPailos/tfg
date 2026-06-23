package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.Expense;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.*;
import gal.usc.telariabackend.model.exceptions.ExpenseNotFoundException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.model.Settlement;
import gal.usc.telariabackend.repository.ExpenseRepository;
import gal.usc.telariabackend.repository.SettlementRepository;
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
    @Mock
    private SettlementRepository settlementRepo;

    private ExpenseService expenseService;

    private UUID userId;
    private UUID tripId;
    private User user;

    @BeforeEach
    void setUp() {
        expenseService = new ExpenseService(tripRepo, userRepo, expenseRepo, settlementRepo);
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
                .name("Cena")
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
                        .amount(10.0).name("x").payerId(userId).beneficiaryIds(List.of(userId))));

        verifyNoInteractions(expenseRepo);
    }

    @Test
    void createExpense_WhenPayerIsNotMember_ShouldThrowAndNotSave() {
        UUID strangerId = UUID.randomUUID();
        Trip trip = new Trip("Viaje", user);

        CreateExpenseRequest request = new CreateExpenseRequest()
                .amount(10.0)
                .name("x")
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
                .name("x")
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
        SettlementSuggestion firstSettlement = result.getSettlements().stream()
                .findFirst().orElseThrow();
        assertEquals(Double.valueOf(15.0), firstSettlement.getAmount());
        assertEquals(manolo.getId(), firstSettlement.getFromId());
        assertEquals(user.getId(), firstSettlement.getToId());
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

        double totalSettled = result.getSettlements().stream().mapToDouble(SettlementSuggestion::getAmount).sum();
        assertEquals(60.0, totalSettled, 0.01);

        result.getSettlements().forEach(s -> assertEquals(user.getId(), s.getToId()));
        Set<UUID> debtors = result.getSettlements().stream()
                .map(SettlementSuggestion::getFromId)
                .collect(java.util.stream.Collectors.toSet());
        assertEquals(Set.of(manolo.getId(), lola.getId()), debtors);

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
        double totalSettled = result.getSettlements().stream().mapToDouble(SettlementSuggestion::getAmount).sum();
        assertEquals(50.0, totalSettled, 0.01);

        // lola (net -50) is the sole debtor: pays user 40 and manolo 10
        result.getSettlements().forEach(s -> assertEquals(lola.getId(), s.getFromId()));
        SettlementSuggestion toUser = result.getSettlements().stream()
                .filter(s -> user.getId().equals(s.getToId()))
                .findFirst().orElseThrow();
        assertEquals(40.0, toUser.getAmount(), 0.01);

        SettlementSuggestion toManolo = result.getSettlements().stream()
                .filter(s -> manolo.getId().equals(s.getToId()))
                .findFirst().orElseThrow();
        assertEquals(10.0, toManolo.getAmount(), 0.01);
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

    // getExpense

    @Test
    void getExpense_WhenUserIsMemberAndExpenseExists_ShouldReturnExpenseDetail() {
        UUID expenseId = UUID.randomUUID();
        Expense expense = mock(Expense.class);
        ExpenseDetail detail = mock(ExpenseDetail.class);

        when(tripRepo.existsByIdAndMembersId(tripId, userId)).thenReturn(true);
        when(expenseRepo.findByIdAndTripId(expenseId, tripId)).thenReturn(Optional.of(expense));
        when(expense.toExpenseDetail()).thenReturn(detail);

        ExpenseDetail result = expenseService.getExpense(tripId, expenseId, userId);

        assertEquals(detail, result);
    }

    @Test
    void getExpense_WhenUserIsNotMember_ShouldThrowAndNotAccessRepo() {
        when(tripRepo.existsByIdAndMembersId(tripId, userId)).thenReturn(false);

        assertThrows(NotATripMemberException.class,
                () -> expenseService.getExpense(tripId, UUID.randomUUID(), userId));

        verifyNoInteractions(expenseRepo);
    }

    @Test
    void getExpense_WhenExpenseDoesNotExist_ShouldThrow() {
        UUID expenseId = UUID.randomUUID();

        when(tripRepo.existsByIdAndMembersId(tripId, userId)).thenReturn(true);
        when(expenseRepo.findByIdAndTripId(expenseId, tripId)).thenReturn(Optional.empty());

        assertThrows(ExpenseNotFoundException.class,
                () -> expenseService.getExpense(tripId, expenseId, userId));
    }

    @Test
    void getExpense_WhenExpenseBelongsToAnotherTrip_ShouldThrow() {
        UUID expenseId = UUID.randomUUID();
        UUID otherTripId = UUID.randomUUID();

        when(tripRepo.existsByIdAndMembersId(otherTripId, userId)).thenReturn(true);
        when(expenseRepo.findByIdAndTripId(expenseId, otherTripId)).thenReturn(Optional.empty());

        assertThrows(ExpenseNotFoundException.class,
                () -> expenseService.getExpense(otherTripId, expenseId, userId));
    }

    // getBalances - settlements

    @Test
    void getBalances_WhenSettlementFullyCoversDebt_ShouldReturnZeroBalances() {
        // user pays €60 for user+manolo → manolo owes user €30
        // manolo settles €30 → both balances reach 0
        User manolo = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        Trip trip = mock(Trip.class);
        Expense expense = new Expense(trip, user, BigDecimal.valueOf(60), "Cena", user, Set.of(user, manolo));
        Settlement settlement = new Settlement(trip, manolo, user, BigDecimal.valueOf(30));

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of(expense));
        when(trip.getSettlements()).thenReturn(List.of(settlement));

        BalancesInfo result = expenseService.getBalances(tripId, userId);

        assertTrue(result.getSettlements().isEmpty());
        result.getBalances().forEach(b -> assertEquals(0.0, b.getAmount(), 0.01));
    }

    @Test
    void getBalances_WhenSettlementPartiallyCoversDebt_ShouldReduceBalanceAndSuggestRemainder() {
        // user pays €60 for user+manolo → manolo owes user €30
        // manolo pays €15 → manolo still owes €15
        User manolo = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        Trip trip = mock(Trip.class);
        Expense expense = new Expense(trip, user, BigDecimal.valueOf(60), "Cena", user, Set.of(user, manolo));
        Settlement settlement = new Settlement(trip, manolo, user, BigDecimal.valueOf(15));

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of(expense));
        when(trip.getSettlements()).thenReturn(List.of(settlement));

        BalancesInfo result = expenseService.getBalances(tripId, userId);

        UserBalance userBalance = result.getBalances().stream()
                .filter(b -> user.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(15.0, userBalance.getAmount(), 0.01);

        UserBalance manoloBalance = result.getBalances().stream()
                .filter(b -> manolo.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(-15.0, manoloBalance.getAmount(), 0.01);

        assertEquals(1, result.getSettlements().size());
        SettlementSuggestion suggestion = result.getSettlements().get(0);
        assertEquals(manolo.getId(), suggestion.getFromId());
        assertEquals(user.getId(), suggestion.getToId());
        assertEquals(15.0, suggestion.getAmount(), 0.01);
    }

    @Test
    void getBalances_WhenSettlementExceedsDebt_ShouldReverseBalance() {
        // user pays €60 for user+manolo → manolo owes user €30
        // manolo overpays €50 → now user owes manolo €20
        User manolo = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        Trip trip = mock(Trip.class);
        Expense expense = new Expense(trip, user, BigDecimal.valueOf(60), "Cena", user, Set.of(user, manolo));
        Settlement settlement = new Settlement(trip, manolo, user, BigDecimal.valueOf(50));

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of(expense));
        when(trip.getSettlements()).thenReturn(List.of(settlement));

        BalancesInfo result = expenseService.getBalances(tripId, userId);

        UserBalance userBalance = result.getBalances().stream()
                .filter(b -> user.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(-20.0, userBalance.getAmount(), 0.01);

        UserBalance manoloBalance = result.getBalances().stream()
                .filter(b -> manolo.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(20.0, manoloBalance.getAmount(), 0.01);

        assertEquals(1, result.getSettlements().size());
        SettlementSuggestion suggestion = result.getSettlements().get(0);
        assertEquals(user.getId(), suggestion.getFromId());
        assertEquals(manolo.getId(), suggestion.getToId());
        assertEquals(20.0, suggestion.getAmount(), 0.01);
    }

    @Test
    void getBalances_WhenMultipleSettlements_ShouldApplyAll() {
        // user pays €90 for 3 → manolo owes €30, lola owes €30
        // manolo settles fully (€30), lola settles partially (€15)
        User manolo = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        User lola = new User("lola", "lola@test.com", "encoded", UUID.randomUUID());
        Trip trip = mock(Trip.class);
        Expense expense = new Expense(trip, user, BigDecimal.valueOf(90), "Cena", user, Set.of(user, manolo, lola));
        Settlement s1 = new Settlement(trip, manolo, user, BigDecimal.valueOf(30));
        Settlement s2 = new Settlement(trip, lola, user, BigDecimal.valueOf(15));

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of(expense));
        when(trip.getSettlements()).thenReturn(List.of(s1, s2));

        BalancesInfo result = expenseService.getBalances(tripId, userId);

        // user: +60 from expense, -30 manolo, -15 lola = +15
        UserBalance userBalance = result.getBalances().stream()
                .filter(b -> user.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(15.0, userBalance.getAmount(), 0.01);

        // manolo: -30 + 30 = 0
        UserBalance manoloBalance = result.getBalances().stream()
                .filter(b -> manolo.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(0.0, manoloBalance.getAmount(), 0.01);

        // lola: -30 + 15 = -15
        UserBalance lolaBalance = result.getBalances().stream()
                .filter(b -> lola.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(-15.0, lolaBalance.getAmount(), 0.01);

        assertEquals(1, result.getSettlements().size());
        SettlementSuggestion suggestion = result.getSettlements().get(0);
        assertEquals(lola.getId(), suggestion.getFromId());
        assertEquals(user.getId(), suggestion.getToId());
        assertEquals(15.0, suggestion.getAmount(), 0.01);
    }

    @Test
    void getBalances_WhenAllDebtsSettledByMultipleSettlements_ShouldReturnNoSuggestions() {
        // e1: user pays €90 → user +60, manolo -30, lola -30
        // e2: manolo pays €60 → manolo +40, user -20, lola -20
        // net: user +40, manolo +10, lola -50
        // lola pays user €40 and manolo €10 → all zero
        User manolo = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        User lola = new User("lola", "lola@test.com", "encoded", UUID.randomUUID());
        Trip trip = mock(Trip.class);
        Expense e1 = new Expense(trip, user, BigDecimal.valueOf(90), "Cena", user, Set.of(user, manolo, lola));
        Expense e2 = new Expense(trip, manolo, BigDecimal.valueOf(60), "Hotel", manolo, Set.of(user, manolo, lola));
        Settlement s1 = new Settlement(trip, lola, user, BigDecimal.valueOf(40));
        Settlement s2 = new Settlement(trip, lola, manolo, BigDecimal.valueOf(10));

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of(e1, e2));
        when(trip.getSettlements()).thenReturn(List.of(s1, s2));

        BalancesInfo result = expenseService.getBalances(tripId, userId);

        assertTrue(result.getSettlements().isEmpty());
        result.getBalances().forEach(b -> assertEquals(0.0, b.getAmount(), 0.01));
    }

    @Test
    void getBalances_WhenSettlementWithNoExpenses_ShouldShowReverseBalance() {
        // No expenses, but manolo paid user €20 (e.g. a direct transfer)
        // manolo: +20 (owed back), user: -20 (owes manolo)
        User manolo = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        Trip trip = mock(Trip.class);
        Settlement settlement = new Settlement(trip, manolo, user, BigDecimal.valueOf(20));

        when(tripRepo.findByIdAndMembersId(tripId, userId)).thenReturn(Optional.of(trip));
        when(trip.getExpenses()).thenReturn(List.of());
        when(trip.getSettlements()).thenReturn(List.of(settlement));

        BalancesInfo result = expenseService.getBalances(tripId, userId);

        UserBalance userBalance = result.getBalances().stream()
                .filter(b -> user.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(-20.0, userBalance.getAmount(), 0.01);

        UserBalance manoloBalance = result.getBalances().stream()
                .filter(b -> manolo.getId().equals(b.getUserId()))
                .findFirst().orElseThrow();
        assertEquals(20.0, manoloBalance.getAmount(), 0.01);

        assertEquals(1, result.getSettlements().size());
        assertEquals(user.getId(), result.getSettlements().get(0).getFromId());
        assertEquals(manolo.getId(), result.getSettlements().get(0).getToId());
        assertEquals(20.0, result.getSettlements().get(0).getAmount(), 0.01);
    }

}
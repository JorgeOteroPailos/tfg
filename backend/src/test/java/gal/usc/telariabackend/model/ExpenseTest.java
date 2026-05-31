package gal.usc.telariabackend.model;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ExpenseTest {

    private User payer;
    private User beneficiary1;
    private User beneficiary2;
    private Expense expense;

    @BeforeEach
    void setUp() {
        User owner = new User("pepe", "pepe@example.com", "encoded", UUID.randomUUID());
        payer = new User("manolo", "manolo@hotmail.com", "encoded", UUID.randomUUID());
        beneficiary1 = new User("lola", "lola@test.com", "encoded", UUID.randomUUID());
        beneficiary2 = new User("ana", "ana@test.com", "encoded", UUID.randomUUID());
        Trip trip = new Trip("Viaje a Roma", owner);
        expense = new Expense(trip, payer, BigDecimal.valueOf(90.0), "Cena", owner,
                Set.of(payer, beneficiary1, beneficiary2));
    }

    // toExpenseSummary

    @Test
    void toExpenseSummary_ShouldReturnCorrectAmount() {
        assertEquals(90.0, expense.toExpenseSummary().getAmount(), 0.001);
    }

    @Test
    void toExpenseSummary_ShouldReturnCorrectPayerId() {
        assertEquals(payer.getId(), expense.toExpenseSummary().getPayerId());
    }

    @Test
    void toExpenseSummary_ShouldReturnCorrectName() {
        assertEquals("Cena", expense.toExpenseSummary().getName());
    }

    @Test
    void toExpenseSummary_ShouldReturnNonNullDatetime() {
        assertNotNull(expense.toExpenseSummary().getDatetime());
    }

    // toExpenseDetail

    @Test
    void toExpenseDetail_ShouldReturnCorrectAmount() {
        assertEquals(90.0, expense.toExpenseDetail().getAmount(), 0.001);
    }

    @Test
    void toExpenseDetail_ShouldReturnCorrectPayerId() {
        assertEquals(payer.getId(), expense.toExpenseDetail().getPayerId());
    }

    @Test
    void toExpenseDetail_ShouldReturnCorrectName() {
        assertEquals("Cena", expense.toExpenseDetail().getName());
    }

    @Test
    void toExpenseDetail_ShouldReturnNonNullDatetime() {
        assertNotNull(expense.toExpenseDetail().getDatetime());
    }

    @Test
    void toExpenseDetail_ShouldReturnAllBeneficiaryIds() {
        var detail = expense.toExpenseDetail();

        assertEquals(3, detail.getBeneficiaryIds().size());
        assertTrue(detail.getBeneficiaryIds().containsAll(
                List.of(payer.getId(), beneficiary1.getId(), beneficiary2.getId())));
    }

    @Test
    void toExpenseDetail_ShouldNotReturnBeneficiaryIdsFromOtherUsers() {
        var detail = expense.toExpenseDetail();

        assertFalse(detail.getBeneficiaryIds().contains(UUID.randomUUID()));
    }
}
package gal.usc.telariabackend.model;

import gal.usc.telariabackend.model.dto.ExpenseCategory;
import gal.usc.telariabackend.model.dto.ExpenseDetail;
import gal.usc.telariabackend.model.dto.ExpenseSummary;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "expenses")
public class Expense {
    @Getter
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Getter
    @ManyToOne(optional = false)
    @JoinColumn(name = "trip_id")
    private Trip trip;

    @Getter
    @ManyToOne(optional = false)
    @JoinColumn(name = "payer_id")
    private User payer;

    @ManyToOne(optional = false)
    @JoinColumn(name = "creator_id")
    private User creator;

    @ManyToMany
    @JoinTable(
            name = "expense_beneficiaries",
            joinColumns = @JoinColumn(name = "expense_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )

    @Getter
    private Set<User> beneficiaries;

    @Getter
    private BigDecimal amount;
    @Getter
    private String name;
    private OffsetDateTime timestamp;

    @Getter
    @Enumerated(EnumType.STRING)
    private ExpenseCategory category = ExpenseCategory.GENERAL;

    public Expense() {}

    public Expense(Trip t, User payer, BigDecimal amount, @NotNull String name, User creator, Set<User> beneficiaries) {
        this(t, payer, amount, name, creator, beneficiaries, ExpenseCategory.GENERAL);
    }

    public Expense(Trip t, User payer, BigDecimal amount, @NotNull String name, User creator, Set<User> beneficiaries, ExpenseCategory category) {
        this.trip = t;
        this.payer = payer;
        this.amount = amount;
        this.name = name;
        this.timestamp = OffsetDateTime.now();
        this.creator = creator;
        this.beneficiaries = beneficiaries;
        this.category = category != null ? category : ExpenseCategory.GENERAL;
    }

    public ExpenseSummary toExpenseSummary() {
        return new ExpenseSummary()
                .id(this.id)
                .amount(this.amount.doubleValue())
                .datetime(this.timestamp)
                .payerId(this.payer.getId())
                .name(this.name)
                .category(this.category);
    }

    public ExpenseDetail toExpenseDetail() {
        return new ExpenseDetail()
                .id(this.id)
                .amount(this.amount.doubleValue())
                .datetime(this.timestamp)
                .payerId(this.payer.getId())
                .creatorId(this.creator.getId())
                .name(this.name)
                .beneficiaryIds(this.beneficiaries.stream().map(User::getId).toList())
                .category(this.category);
    }

}

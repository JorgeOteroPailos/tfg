package gal.usc.telariabackend.model;

import jakarta.persistence.*;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "expenses")
public class Expense {
    @Getter
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "trip_id")
    private Trip trip;

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
    private Set<User> beneficiaries;

    private BigDecimal amount;
    private String description;
    private LocalDateTime timestamp;

    public Expense() {}

    public Expense(Trip trip, User payer, BigDecimal amount, String description, LocalDateTime timestamp, User creator, Set<User> beneficiaries) {
        this.trip = trip;
        this.payer = payer;
        this.amount = amount;
        this.description = description;
        this.timestamp = timestamp;
        this.creator = creator;
        this.beneficiaries = beneficiaries;
    }

}

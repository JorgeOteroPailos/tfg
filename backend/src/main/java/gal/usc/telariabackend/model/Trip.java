package gal.usc.telariabackend.model;

import gal.usc.telariabackend.model.dto.TripSummary;
import gal.usc.telariabackend.model.exceptions.AlreadyDoneException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Entity
@Table(name = "trips")
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Trip {

    @Getter
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @Getter
    private String name;

    @Getter
    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime creationDate;

    @Getter
    @ManyToMany
    @JoinTable(
            name = "trip_members",
            joinColumns = @JoinColumn(name = "trip_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private final Set<User> members = new HashSet<>();

    @Getter
    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
    private final List<Expense> expenses = new ArrayList<>();

    @Getter
    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
    private final List<Event> events = new ArrayList<>();

    @Getter
    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
    private final List<Settlement> settlements = new ArrayList<>();

    protected Trip(){}

    public Trip(@NotNull String tripname, User owner) {
        this.members.add(owner);
        this.name=tripname;
    }

    public TripSummary toTripSummary() {
        BigDecimal totalSpent = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new TripSummary()
                .id(this.id)
                .name(this.name)
                .memberCount(members.size())
                .totalSpent(totalSpent.doubleValue())
                .creationDate(this.creationDate != null ? this.creationDate.atOffset(ZoneOffset.UTC) : null);
    }

    public void assertIsMember(UUID userId) {
        if (members.stream().noneMatch(u -> u.getId().equals(userId))) {
            throw new NotATripMemberException("User " + userId + " is not a member of trip " + this.id);
        }
    }

    public void assertIsMember(User u) {
        if (!members.contains(u)) {
            throw new NotATripMemberException("User " + u.getId() + " is not a member of trip " + this.id);
        }
    }

    public void assertIsNotMember(UUID userId) {
        if (members.stream().anyMatch(u -> u.getId().equals(userId))) {
            throw new AlreadyDoneException("User " + userId + " is already a member of trip " + this.id);
        }
    }

    public void assertIsNotMember(User u) {
        if (members.contains(u)) {
            throw new AlreadyDoneException("User " + u.getId()+ " is already a member of trip " + this.id);
        }
    }
}

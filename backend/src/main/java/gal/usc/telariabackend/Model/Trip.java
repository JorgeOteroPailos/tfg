package gal.usc.telariabackend.Model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.*;

@Entity
@Table(name = "trips")
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String name;

    @ManyToOne(optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @ManyToMany
    @JoinTable(
            name = "trip_members",
            joinColumns = @JoinColumn(name = "trip_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private final Set<User> members = new HashSet<>();

    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
    private final List<Event> events = new ArrayList<>();

    public UUID getId(){return id;}

    protected Trip(){}

    public Trip(@NotNull String tripname, User owner) {
        this.owner = owner;
        this.members.add(owner);
        this.name=tripname;
    }
}

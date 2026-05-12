package gal.usc.telariabackend.model;

import gal.usc.telariabackend.model.dto.TripDetail;
import gal.usc.telariabackend.model.dto.TripSummary;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;

import java.util.*;

@Entity
@Table(name = "trips")
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String name;

    @ManyToMany
    @JoinTable(
            name = "trip_members",
            joinColumns = @JoinColumn(name = "trip_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private final Set<User> members = new HashSet<>();

    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
    private final List<Expense> expenses = new ArrayList<>();

    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
    private final List<Event> events = new ArrayList<>();

    public UUID getId(){return id;}

    protected Trip(){}

    public Trip(@NotNull String tripname, User owner) {
        this.members.add(owner);
        this.name=tripname;
    }

    public TripSummary toTripSummary() {
        return new TripSummary().id(this.id).name(this.name);
    }

    public String getName() {
        return  name;
    }

    public Set<User> getMembers() {
        return members;
    }

    public TripDetail toTripDetails(){return new TripDetail().id(this.id).name(this.name).hola("TODO");}//TODO

    public void assertIsMember(UUID userId) {
        boolean isMember = members.stream()
                .anyMatch(u -> u.getId().equals(userId));

        if (!isMember) {
            throw new NotATripMemberException("User " + userId + " is not a member of trip " + this.id);
        }
    }

    public void assertIsMember(User u) {
        boolean isMember = members.contains(u);

        if (!isMember) {
            throw new NotATripMemberException("User " + u.getId() + " is not a member of trip " + this.id);
        }
    }
}

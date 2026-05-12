package gal.usc.telariabackend.model;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.UUID;

@MappedSuperclass
@Getter
abstract class PendingMembership{
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "trip_id")
    private Trip trip;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    private LocalDateTime createdAt;

    protected PendingMembership(Trip trip, User user) {
        this.trip = trip;
        this.user = user;
        this.createdAt = LocalDateTime.now();
    }

    protected PendingMembership() {}

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PendingMembership other = (PendingMembership) o;
        return id != null && id.equals(other.id);
    }
}

package gal.usc.telariabackend.model;

import jakarta.persistence.*;
import lombok.EqualsAndHashCode;

import java.time.ZonedDateTime;
import java.util.UUID;

@Entity
@Table(name = "events")
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Event {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    private ZonedDateTime startTime;
    private int duration; //in minutes
    @Embedded
    private Location location=new Location();

    protected Event() {}
}

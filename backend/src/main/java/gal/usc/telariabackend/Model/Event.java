package gal.usc.telariabackend.Model;

import jakarta.persistence.*;

import java.time.ZonedDateTime;
import java.util.UUID;

@Entity
@Table(name = "events")
public class Event {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
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

package gal.usc.telariabackend.model;

import gal.usc.telariabackend.model.dto.EventSummary;
import jakarta.persistence.*;
import lombok.EqualsAndHashCode;
import lombok.Getter;

import java.time.ZonedDateTime;
import java.util.UUID;

@Entity
@Table(name = "events")
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Event {
    @Getter
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @Getter
    @ManyToOne(optional = false)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @Getter
    private String name;

    @Getter
    private ZonedDateTime startTime;

    @Getter
    private int duration; // in minutes

    @Getter
    @Embedded
    @AttributeOverrides({
            @AttributeOverride(name = "name",      column = @Column(name = "location_name")),
            @AttributeOverride(name = "address",   column = @Column(name = "location_address")),
            @AttributeOverride(name = "latitude",  column = @Column(name = "location_latitude")),
            @AttributeOverride(name = "longitude", column = @Column(name = "location_longitude"))
    })
    private Location location = new Location();

    protected Event() {}

    public Event(Trip trip, String name, ZonedDateTime startTime, Integer duration, Location location) {
        this.trip = trip;
        this.name = name;
        this.startTime = startTime;
        this.duration = duration != null ? duration : 0;
        this.location = location != null ? location : new Location();
    }

    public EventSummary toEventSummary() {
        gal.usc.telariabackend.model.dto.Location locationDto = null;
        if (this.location != null && !this.location.isEmpty()) {
            locationDto = new gal.usc.telariabackend.model.dto.Location()
                    .name(this.location.getName())
                    .address(this.location.getAddress())
                    .latitude(this.location.getLatitude())
                    .longitude(this.location.getLongitude());
        }
        return new EventSummary()
                .id(this.id)
                .name(this.name)
                .startTime(this.startTime != null ? this.startTime.toOffsetDateTime() : null)
                .duration(this.duration)
                .location(locationDto);
    }
}

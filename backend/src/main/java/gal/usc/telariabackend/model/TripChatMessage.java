package gal.usc.telariabackend.model;

import jakarta.persistence.*;
import lombok.EqualsAndHashCode;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "trip_chat_messages")
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class TripChatMessage {

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
    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Getter
    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Getter
    @Column(nullable = false)
    private OffsetDateTime timestamp;

    protected TripChatMessage() {}

    public TripChatMessage(Trip trip, User user, String content) {
        this.trip = trip;
        this.user = user;
        this.content = content;
        this.timestamp = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public gal.usc.telariabackend.model.dto.TripChatMessage toDto() {
        return new gal.usc.telariabackend.model.dto.TripChatMessage()
                .id(this.id)
                .senderId(this.user.getId())
                .senderUsername(this.user.getUsername())
                .content(this.content)
                .timestamp(this.timestamp);
    }
}

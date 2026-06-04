package gal.usc.telariabackend.model;

import jakarta.persistence.*;
import lombok.EqualsAndHashCode;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ai_chat_messages")
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class AiChatMessage {

    public enum Role { USER, ASSISTANT }

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
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Getter
    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Getter
    @Column(nullable = false)
    private OffsetDateTime timestamp;

    protected AiChatMessage() {}

    public AiChatMessage(Trip trip, User user, Role role, String content) {
        this.trip = trip;
        this.user = user;
        this.role = role;
        this.content = content;
        this.timestamp = OffsetDateTime.now();
    }

    public gal.usc.telariabackend.model.dto.AiChatMessage toDto() {
        return new gal.usc.telariabackend.model.dto.AiChatMessage()
                .id(this.id)
                .role(this.role == Role.USER
                        ? gal.usc.telariabackend.model.dto.AiChatMessage.RoleEnum.USER
                        : gal.usc.telariabackend.model.dto.AiChatMessage.RoleEnum.ASSISTANT)
                .content(this.content)
                .timestamp(this.timestamp);
    }
}

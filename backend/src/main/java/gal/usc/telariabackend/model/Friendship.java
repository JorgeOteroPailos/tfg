package gal.usc.telariabackend.model;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "friendships",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user1_id", "user2_id"}))
@Getter
public class Friendship {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Always store with user1.id < user2.id (lexicographic) to enforce uniqueness
    @ManyToOne(optional = false)
    @JoinColumn(name = "user1_id")
    private User user1;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user2_id")
    private User user2;

    private LocalDateTime createdAt;

    public Friendship(User a, User b) {
        if (a.getId().toString().compareTo(b.getId().toString()) <= 0) {
            this.user1 = a;
            this.user2 = b;
        } else {
            this.user1 = b;
            this.user2 = a;
        }
        this.createdAt = LocalDateTime.now();
    }

    public Friendship() {}

    public User getFriendOf(UUID userId) {
        return user1.getId().equals(userId) ? user2 : user1;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Friendship other = (Friendship) o;
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return id != null ? id.hashCode() : 0;
    }
}

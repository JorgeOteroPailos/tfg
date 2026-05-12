package gal.usc.telariabackend.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name="joinrequest")
@Getter
@Setter
public class JoinRequest extends PendingMembership {
    public JoinRequest(Trip trip, User user) {
        super(trip, user);
    }

    public JoinRequest() {
    }
}
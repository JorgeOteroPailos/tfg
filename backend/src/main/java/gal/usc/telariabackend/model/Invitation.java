package gal.usc.telariabackend.model;

import gal.usc.telariabackend.model.dto.InvitationSummary;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name="invitations")
@Getter @Setter
public class Invitation extends PendingMembership {
    public Invitation(Trip trip, User user) {
        super(trip, user);
    }

    public Invitation() {

    }

    public InvitationSummary toInvitationSummary(){
        return new InvitationSummary().id(this.getId()).tripName(this.getTrip().getName()).tripId(this.getTrip().getId());
    }
}

package gal.usc.telariabackend.model;

import jakarta.persistence.*;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "settlements")
public class Settlement{
    @Getter
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Getter
    @ManyToOne(optional = false)
    @JoinColumn(name = "trip_id")
    private Trip trip;

    @Getter
    @ManyToOne(optional = false)
    @JoinColumn(name = "payer_id")
    private User payer;

    @ManyToOne(optional = false)
    @JoinColumn(name = "receiver_id")
    private User receiver;

    @Getter
    private BigDecimal amount;
    private OffsetDateTime timestamp;

    public Settlement(Trip trip, User payer, User receiver, BigDecimal amount) {
        this.trip = trip;
        this.payer = payer;
        this.receiver = receiver;
        this.amount = amount;
    }
}

package gal.usc.telariabackend.model;

import jakarta.persistence.Embeddable;
import lombok.Getter;

@Embeddable
@Getter
public class Location {
    private String name;
    private String address;
    private Double latitude;
    private Double longitude;

    public Location() {}

    public Location(String name, String address, Double latitude, Double longitude) {
        this.name = name;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public boolean isEmpty() {
        return name == null && address == null && latitude == null && longitude == null;
    }
}

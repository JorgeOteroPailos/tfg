package gal.usc.telariabackend.Model;

import java.time.ZonedDateTime;

public class Event {
    private ZonedDateTime startTime;
    private int duration; //in minutes
    private Location location=new Location();
}

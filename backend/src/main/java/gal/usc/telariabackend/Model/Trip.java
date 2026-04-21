package gal.usc.telariabackend.Model;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class Trip {
    private Set<User> members = new HashSet<>();
    private final User owner;
    private Set<User> viewers= new HashSet<>();
    private List<Event> events=  new ArrayList<>();

    private LocalDate startDate;
    private LocalDate endDate;

    public Trip(User owner){
        this.owner = owner;
        members.add(owner);
    }
}

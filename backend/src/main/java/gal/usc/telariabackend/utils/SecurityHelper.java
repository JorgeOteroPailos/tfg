package gal.usc.telariabackend.utils;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.Optional;
import java.util.UUID;

@Component
public class SecurityHelper {
    public UUID getUserId() {
        return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .map(Principal::getName)
                .map(UUID::fromString)
                .orElseThrow(() -> new IllegalStateException("Not Authenticated User"));
    }
}

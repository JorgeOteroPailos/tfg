package gal.usc.telariabackend.utils;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.Optional;

@Component
public class SecurityHelper {
    public String getEmail() {
        return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .map(Principal::getName)
                .orElseThrow(() -> new IllegalStateException("Not Authenticated User"));
    }
}

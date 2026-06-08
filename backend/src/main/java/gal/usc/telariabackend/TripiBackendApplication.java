package gal.usc.telariabackend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TripiBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(TripiBackendApplication.class, args);
    }

}

package gal.usc.telariabackend.configuration;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "scheduling")
@Data
public class SchedulingProperties {

    private long orphanCleanupDelayMs = 900_000;       // 15 min
    private int orphanCleanupAgeMinutes = 30;
    private long thumbnailBackfillDelayMs = 1_800_000; // 30 min
    private String chatCleanupCron = "0 0 2 * * *";
    private int chatRetentionDays = 30;
}

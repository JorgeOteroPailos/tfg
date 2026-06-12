package gal.usc.telariabackend.configuration;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "images")
@Data
public class ImageProperties {

    private int avatarMaxDimension = 512;
    private int thumbnailMaxDimension = 512;
    private double jpegQuality = 0.8;
}

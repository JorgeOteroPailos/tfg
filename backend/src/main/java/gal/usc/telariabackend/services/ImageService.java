package gal.usc.telariabackend.services;

import gal.usc.telariabackend.configuration.ImageProperties;
import net.coobird.thumbnailator.Thumbnails;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
public class ImageService {

    private static final Logger log = LoggerFactory.getLogger(ImageService.class);

    private static final Set<String> SUPPORTED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/bmp", "image/webp");

    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "gif", "bmp", "webp");

    private final ImageProperties imageProperties;

    public ImageService(ImageProperties imageProperties) {
        this.imageProperties = imageProperties;
    }

    /**
     * Downscales the given image so that no dimension exceeds maxDimension
     * (never upscales) and re-encodes it as JPEG.
     *
     * @return the JPEG bytes, or empty if the input cannot be decoded
     *         (unsupported format, corrupt data) or any error occurs. Never throws.
     */
    public Optional<byte[]> downscaleToJpeg(byte[] source, int maxDimension) {
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(source));
            if (image == null) {
                log.warn("Image downscale skipped: data could not be decoded as an image");
                return Optional.empty();
            }

            int targetMax = Math.min(maxDimension, Math.max(image.getWidth(), image.getHeight()));

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Thumbnails.of(image)
                    .size(targetMax, targetMax)
                    .imageType(BufferedImage.TYPE_INT_RGB)
                    .outputFormat("jpg")
                    .outputQuality(imageProperties.getJpegQuality())
                    .toOutputStream(out);
            return Optional.of(out.toByteArray());
        } catch (Exception e) {
            log.warn("Image downscale failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Whether the file looks like an image we can decode server-side
     * (content type may be null for documents created before it was stored).
     * HEIC/HEIF is deliberately excluded: ImageIO has no reader for it.
     */
    public boolean isSupportedImage(String contentType, String fileName) {
        if (contentType != null
                && SUPPORTED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            return true;
        }
        if (fileName == null) {
            return false;
        }
        int dot = fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) {
            return false;
        }
        return SUPPORTED_EXTENSIONS.contains(fileName.substring(dot + 1).toLowerCase(Locale.ROOT));
    }
}

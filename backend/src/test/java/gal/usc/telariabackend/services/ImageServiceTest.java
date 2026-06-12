package gal.usc.telariabackend.services;

import gal.usc.telariabackend.configuration.ImageProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class ImageServiceTest {

    private ImageService imageService;

    @BeforeEach
    void setUp() {
        imageService = new ImageService(new ImageProperties());
    }

    private static byte[] pngBytes(int width, int height, int imageType) throws IOException {
        BufferedImage image = new BufferedImage(width, height, imageType);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.ORANGE);
        g.fillRect(0, 0, width, height);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    @Test
    void downscaleToJpeg_LargeImage_ShouldFitWithinMaxDimensionKeepingAspectRatio() throws IOException {
        byte[] source = pngBytes(2000, 1000, BufferedImage.TYPE_INT_RGB);

        Optional<byte[]> result = imageService.downscaleToJpeg(source, 512);

        assertTrue(result.isPresent());
        BufferedImage thumb = ImageIO.read(new ByteArrayInputStream(result.get()));
        assertNotNull(thumb);
        assertEquals(512, thumb.getWidth());
        assertEquals(256, thumb.getHeight());
        assertTrue(result.get().length < source.length);
    }

    @Test
    void downscaleToJpeg_SmallImage_ShouldNotUpscale() throws IOException {
        byte[] source = pngBytes(100, 80, BufferedImage.TYPE_INT_RGB);

        Optional<byte[]> result = imageService.downscaleToJpeg(source, 512);

        assertTrue(result.isPresent());
        BufferedImage thumb = ImageIO.read(new ByteArrayInputStream(result.get()));
        assertEquals(100, thumb.getWidth());
        assertEquals(80, thumb.getHeight());
    }

    @Test
    void downscaleToJpeg_PngWithAlpha_ShouldProduceValidJpeg() throws IOException {
        byte[] source = pngBytes(800, 600, BufferedImage.TYPE_INT_ARGB);

        Optional<byte[]> result = imageService.downscaleToJpeg(source, 512);

        assertTrue(result.isPresent());
        BufferedImage thumb = ImageIO.read(new ByteArrayInputStream(result.get()));
        assertNotNull(thumb);
        assertEquals(512, thumb.getWidth());
        assertEquals(384, thumb.getHeight());
    }

    @Test
    void downscaleToJpeg_GarbageBytes_ShouldReturnEmptyWithoutThrowing() {
        assertTrue(imageService.downscaleToJpeg("not an image".getBytes(), 512).isEmpty());
    }

    @Test
    void downscaleToJpeg_EmptyInput_ShouldReturnEmptyWithoutThrowing() {
        assertTrue(imageService.downscaleToJpeg(new byte[0], 512).isEmpty());
    }

    @Test
    void isSupportedImage_KnownContentTypes() {
        assertTrue(imageService.isSupportedImage("image/png", "whatever.bin"));
        assertTrue(imageService.isSupportedImage("image/jpeg", null));
        assertFalse(imageService.isSupportedImage("application/pdf", "billete.pdf"));
        assertFalse(imageService.isSupportedImage("image/heic", "photo.heic"));
    }

    @Test
    void isSupportedImage_NullContentType_ShouldFallBackToExtension() {
        assertTrue(imageService.isSupportedImage(null, "foto.JPG"));
        assertTrue(imageService.isSupportedImage(null, "captura.webp"));
        assertFalse(imageService.isSupportedImage(null, "photo.heic"));
        assertFalse(imageService.isSupportedImage(null, "sin-extension"));
        assertFalse(imageService.isSupportedImage(null, null));
    }
}

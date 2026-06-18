package gal.usc.telariabackend.services;

import gal.usc.telariabackend.configuration.ImageProperties;
import gal.usc.telariabackend.configuration.MinioConfig;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.AvatarDownloadResponse;
import gal.usc.telariabackend.model.dto.AvatarUploadResponse;
import gal.usc.telariabackend.model.dto.OwnProfile;
import gal.usc.telariabackend.model.exceptions.AlreadyDoneException;
import gal.usc.telariabackend.model.exceptions.AvatarNotFoundException;
import gal.usc.telariabackend.model.exceptions.DocumentNotFoundInStorageException;
import gal.usc.telariabackend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.UUID;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final MinioConfig minioConfig;
    private final ImageService imageService;
    private final ImageProperties imageProperties;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                       S3Client s3Client,
                       S3Presigner s3Presigner,
                       MinioConfig minioConfig,
                       ImageService imageService,
                       ImageProperties imageProperties,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.minioConfig = minioConfig;
        this.imageService = imageService;
        this.imageProperties = imageProperties;
        this.passwordEncoder = passwordEncoder;
    }

    public OwnProfile getProfile(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(IllegalStateException::new)
                .toOwnProfile();
    }

    @Transactional
    public OwnProfile updateProfile(UUID userId, String username, String email, String currentPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(IllegalStateException::new);

        if (username != null) {
            user.setUsername(username);
        }
        if (email != null && !email.equals(user.getEmail())) {
            // Changing the email is a sensitive operation: re-authenticate with the current password
            if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPassword())) {
                throw new BadCredentialsException("Current password is incorrect");
            }
            if (userRepository.existsByEmail(email)) {
                throw new AlreadyDoneException("There is already a registered user with email " + email);
            }
            user.setEmail(email);
        }

        userRepository.save(user);
        return user.toOwnProfile();
    }

    @Transactional
    public AvatarUploadResponse initAvatarUpload(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(IllegalStateException::new);

        String objectKey = "avatars/" + userId + "/" + UUID.randomUUID();
        user.setPendingAvatarObjectKey(objectKey);
        userRepository.save(user);

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(minioConfig.getPresignedUrlExpirationMinutes()))
                .putObjectRequest(PutObjectRequest.builder()
                        .bucket(minioConfig.getBucket())
                        .key(objectKey)
                        .build())
                .build();

        String uploadUrl = s3Presigner.presignPutObject(presignRequest).url().toString();

        return new AvatarUploadResponse().uploadUrl(uploadUrl);
    }

    @Transactional
    public void confirmAvatarUpload(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(IllegalStateException::new);

        String pendingKey = user.getPendingAvatarObjectKey();
        if (pendingKey == null) {
            throw new AvatarNotFoundException();
        }

        try {
            s3Client.headObject(HeadObjectRequest.builder()
                    .bucket(minioConfig.getBucket())
                    .key(pendingKey)
                    .build());
        } catch (NoSuchKeyException e) {
            throw new DocumentNotFoundInStorageException();
        }

        downscaleAvatarInPlace(userId, pendingKey);

        String oldKey = user.getAvatarObjectKey();
        user.setAvatarObjectKey(pendingKey);
        user.setPendingAvatarObjectKey(null);
        userRepository.save(user);

        if (oldKey != null) {
            try {
                s3Client.deleteObject(DeleteObjectRequest.builder()
                        .bucket(minioConfig.getBucket())
                        .key(oldKey)
                        .build());
            } catch (Exception e) {
                log.warn("Failed to delete old avatar '{}' for user {}: {}", oldKey, userId, e.getMessage());
            }
        }
    }

    /**
     * Replaces the uploaded avatar with a downscaled JPEG under the same key,
     * discarding the original. If the image cannot be decoded (e.g. HEIC),
     * the original upload is kept as-is.
     */
    private void downscaleAvatarInPlace(UUID userId, String objectKey) {
        try {
            byte[] original = s3Client.getObjectAsBytes(GetObjectRequest.builder()
                    .bucket(minioConfig.getBucket())
                    .key(objectKey)
                    .build()).asByteArray();

            imageService.downscaleToJpeg(original, imageProperties.getAvatarMaxDimension())
                    .ifPresent(resized -> s3Client.putObject(PutObjectRequest.builder()
                                    .bucket(minioConfig.getBucket())
                                    .key(objectKey)
                                    .contentType("image/jpeg")
                                    .build(),
                            RequestBody.fromBytes(resized)));
        } catch (Exception e) {
            log.warn("Avatar downscale failed for user {}, keeping original upload: {}", userId, e.getMessage());
        }
    }

    public AvatarDownloadResponse getAvatarDownloadUrl(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(AvatarNotFoundException::new);

        if (user.getAvatarObjectKey() == null) {
            throw new AvatarNotFoundException();
        }

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(minioConfig.getPresignedUrlExpirationMinutes()))
                .getObjectRequest(GetObjectRequest.builder()
                        .bucket(minioConfig.getBucket())
                        .key(user.getAvatarObjectKey())
                        .build())
                .build();

        return new AvatarDownloadResponse().downloadUrl(s3Presigner.presignGetObject(presignRequest).url().toString());
    }
}

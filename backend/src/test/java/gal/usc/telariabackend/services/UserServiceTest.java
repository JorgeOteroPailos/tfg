package gal.usc.telariabackend.services;

import gal.usc.telariabackend.configuration.ImageProperties;
import gal.usc.telariabackend.configuration.MinioConfig;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.AvatarUploadResponse;
import gal.usc.telariabackend.model.dto.OwnProfile;
import gal.usc.telariabackend.model.exceptions.AlreadyDoneException;
import gal.usc.telariabackend.model.exceptions.AvatarNotFoundException;
import gal.usc.telariabackend.repository.UserRepository;

import java.net.URI;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private S3Client s3Client;

    @Mock
    private S3Presigner s3Presigner;

    @Mock
    private ImageService imageService;

    @Mock
    private PasswordEncoder passwordEncoder;

    private MinioConfig minioConfig;

    private UserService userService;

    @BeforeEach
    void setUp() {
        minioConfig = new MinioConfig();
        minioConfig.setBucket("test-bucket");
        minioConfig.setPresignedUrlExpirationMinutes(15);

        userService = new UserService(userRepository, s3Client, s3Presigner, minioConfig,
                imageService, new ImageProperties(), passwordEncoder);
    }

    private void stubAvatarBytesInStorage(byte[] bytes) {
        when(s3Client.getObjectAsBytes(any(GetObjectRequest.class)))
                .thenReturn(ResponseBytes.fromByteArray(GetObjectResponse.builder().build(), bytes));
    }

    @Test
    void updateProfile_WhenUsernameProvided_ShouldPersistNewUsernameAndKeepEmail() {
        UUID userId = UUID.randomUUID();
        User user = new User("oldName", "test@test.com", "encoded-password", userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        OwnProfile result = userService.updateProfile(userId, "newName", null, null);

        assertEquals("newName", result.getUsername());
        assertEquals("test@test.com", result.getEmail());
        assertEquals(userId, result.getId());
        assertFalse(result.getHasAvatar());
        verify(userRepository).save(user);
        assertEquals("newName", user.getUsername());
        assertEquals("test@test.com", user.getEmail());
    }

    @Test
    void updateProfile_WhenEmailProvidedAndFreeAndPasswordCorrect_ShouldPersistNewEmail() {
        UUID userId = UUID.randomUUID();
        User user = new User("userName", "old@test.com", "encoded-password", userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret", "encoded-password")).thenReturn(true);
        when(userRepository.existsByEmail("new@test.com")).thenReturn(false);

        OwnProfile result = userService.updateProfile(userId, null, "new@test.com", "secret");

        assertEquals("new@test.com", result.getEmail());
        assertEquals("userName", result.getUsername());
        verify(userRepository).save(user);
        assertEquals("new@test.com", user.getEmail());
    }

    @Test
    void updateProfile_WhenEmailChangedWithWrongPassword_ShouldThrowAndNotChangeEmail() {
        UUID userId = UUID.randomUUID();
        User user = new User("userName", "old@test.com", "encoded-password", userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "encoded-password")).thenReturn(false);

        assertThrows(
                BadCredentialsException.class,
                () -> userService.updateProfile(userId, null, "new@test.com", "wrong")
        );

        assertEquals("old@test.com", user.getEmail());
        verify(userRepository, never()).existsByEmail(anyString());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void updateProfile_WhenEmailChangedWithoutPassword_ShouldThrowAndNotChangeEmail() {
        UUID userId = UUID.randomUUID();
        User user = new User("userName", "old@test.com", "encoded-password", userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        assertThrows(
                BadCredentialsException.class,
                () -> userService.updateProfile(userId, null, "new@test.com", null)
        );

        assertEquals("old@test.com", user.getEmail());
        verify(userRepository, never()).existsByEmail(anyString());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void updateProfile_WhenEmailAlreadyInUse_ShouldThrowAndNotChangeEmail() {
        UUID userId = UUID.randomUUID();
        User user = new User("userName", "old@test.com", "encoded-password", userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret", "encoded-password")).thenReturn(true);
        when(userRepository.existsByEmail("taken@test.com")).thenReturn(true);

        assertThrows(
                AlreadyDoneException.class,
                () -> userService.updateProfile(userId, null, "taken@test.com", "secret")
        );

        assertEquals("old@test.com", user.getEmail());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void updateProfile_WhenEmailIsUnchanged_ShouldNotCheckUniquenessNorPassword() {
        UUID userId = UUID.randomUUID();
        User user = new User("userName", "same@test.com", "encoded-password", userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        OwnProfile result = userService.updateProfile(userId, "newName", "same@test.com", null);

        assertEquals("same@test.com", result.getEmail());
        assertEquals("newName", result.getUsername());
        verify(userRepository, never()).existsByEmail(anyString());
        verifyNoInteractions(passwordEncoder);
        verify(userRepository).save(user);
    }

    @Test
    void initAvatarUpload_ShouldStorePendingKeyAndReturnPresignedUrl() throws Exception {
        UUID userId = UUID.randomUUID();
        User user = new User("userName", "test@test.com", "encoded-password", userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        PresignedPutObjectRequest presigned = mock(PresignedPutObjectRequest.class);
        when(presigned.url()).thenReturn(URI.create("http://minio/test-bucket/avatars/key").toURL());
        when(s3Presigner.presignPutObject(any(PutObjectPresignRequest.class))).thenReturn(presigned);

        AvatarUploadResponse result = userService.initAvatarUpload(userId);

        assertNotNull(result.getUploadUrl());
        assertNotNull(user.getPendingAvatarObjectKey());
        assertTrue(user.getPendingAvatarObjectKey().startsWith("avatars/" + userId + "/"));
        verify(userRepository).save(user);
    }

    @Test
    void confirmAvatarUpload_WhenPendingExistsInStorage_ShouldPromoteKeyAndDeleteOldAvatar() {
        UUID userId = UUID.randomUUID();
        User user = new User("userName", "test@test.com", "encoded-password", userId);
        user.setAvatarObjectKey("avatars/" + userId + "/old");
        user.setPendingAvatarObjectKey("avatars/" + userId + "/new");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().build());
        stubAvatarBytesInStorage(new byte[]{1, 2, 3});
        byte[] resized = new byte[]{9, 9};
        when(imageService.downscaleToJpeg(any(byte[].class), anyInt())).thenReturn(Optional.of(resized));

        userService.confirmAvatarUpload(userId);

        assertEquals("avatars/" + userId + "/new", user.getAvatarObjectKey());
        assertNull(user.getPendingAvatarObjectKey());
        verify(userRepository).save(user);

        ArgumentCaptor<PutObjectRequest> putCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(putCaptor.capture(), any(software.amazon.awssdk.core.sync.RequestBody.class));
        assertEquals("avatars/" + userId + "/new", putCaptor.getValue().key());
        assertEquals("image/jpeg", putCaptor.getValue().contentType());

        ArgumentCaptor<DeleteObjectRequest> deleteCaptor = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client).deleteObject(deleteCaptor.capture());
        assertEquals("avatars/" + userId + "/old", deleteCaptor.getValue().key());
    }

    @Test
    void confirmAvatarUpload_WhenImageNotDecodable_ShouldKeepOriginalAndStillPromote() {
        UUID userId = UUID.randomUUID();
        User user = new User("userName", "test@test.com", "encoded-password", userId);
        user.setPendingAvatarObjectKey("avatars/" + userId + "/new");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().build());
        stubAvatarBytesInStorage(new byte[]{1, 2, 3});
        when(imageService.downscaleToJpeg(any(byte[].class), anyInt())).thenReturn(Optional.empty());

        userService.confirmAvatarUpload(userId);

        assertEquals("avatars/" + userId + "/new", user.getAvatarObjectKey());
        assertNull(user.getPendingAvatarObjectKey());
        verify(s3Client, never()).putObject(any(PutObjectRequest.class),
                any(software.amazon.awssdk.core.sync.RequestBody.class));
        verify(userRepository).save(user);
    }

    @Test
    void confirmAvatarUpload_WhenDownloadForDownscaleFails_ShouldStillPromote() {
        UUID userId = UUID.randomUUID();
        User user = new User("userName", "test@test.com", "encoded-password", userId);
        user.setPendingAvatarObjectKey("avatars/" + userId + "/new");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().build());
        when(s3Client.getObjectAsBytes(any(GetObjectRequest.class)))
                .thenThrow(new RuntimeException("storage hiccup"));

        userService.confirmAvatarUpload(userId);

        assertEquals("avatars/" + userId + "/new", user.getAvatarObjectKey());
        assertNull(user.getPendingAvatarObjectKey());
        verify(userRepository).save(user);
    }

    @Test
    void confirmAvatarUpload_WhenNothingPending_ShouldThrowAndNotTouchStorage() {
        UUID userId = UUID.randomUUID();
        User user = new User("userName", "test@test.com", "encoded-password", userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        assertThrows(AvatarNotFoundException.class, () -> userService.confirmAvatarUpload(userId));

        verifyNoInteractions(s3Client);
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void confirmAvatarUpload_WhenFileMissingInStorage_ShouldKeepCurrentAvatar() {
        UUID userId = UUID.randomUUID();
        User user = new User("userName", "test@test.com", "encoded-password", userId);
        user.setAvatarObjectKey("avatars/" + userId + "/old");
        user.setPendingAvatarObjectKey("avatars/" + userId + "/new");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenThrow(NoSuchKeyException.builder().build());

        assertThrows(
                gal.usc.telariabackend.model.exceptions.DocumentNotFoundInStorageException.class,
                () -> userService.confirmAvatarUpload(userId)
        );

        assertEquals("avatars/" + userId + "/old", user.getAvatarObjectKey());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void getAvatarDownloadUrl_WhenUserHasAvatar_ShouldReturnPresignedUrl() throws Exception {
        UUID userId = UUID.randomUUID();
        User user = new User("userName", "test@test.com", "encoded-password", userId);
        user.setAvatarObjectKey("avatars/" + userId + "/current");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        PresignedGetObjectRequest presigned = mock(PresignedGetObjectRequest.class);
        when(presigned.url()).thenReturn(URI.create("http://minio/test-bucket/avatars/current").toURL());
        when(s3Presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenReturn(presigned);

        assertNotNull(userService.getAvatarDownloadUrl(userId).getDownloadUrl());
    }

    @Test
    void getAvatarDownloadUrl_WhenUserHasNoAvatar_ShouldThrow() {
        UUID userId = UUID.randomUUID();
        User user = new User("userName", "test@test.com", "encoded-password", userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        assertThrows(AvatarNotFoundException.class, () -> userService.getAvatarDownloadUrl(userId));

        verifyNoInteractions(s3Presigner);
    }
}

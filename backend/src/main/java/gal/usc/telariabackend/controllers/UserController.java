package gal.usc.telariabackend.controllers;

import gal.usc.telariabackend.model.dto.AvatarDownloadResponse;
import gal.usc.telariabackend.model.dto.AvatarUploadRequest;
import gal.usc.telariabackend.model.dto.AvatarUploadResponse;
import gal.usc.telariabackend.model.dto.ChangePasswordRequest;
import gal.usc.telariabackend.model.dto.DeleteAccountRequest;
import gal.usc.telariabackend.model.dto.LoginResponse;
import gal.usc.telariabackend.model.dto.OwnProfile;
import gal.usc.telariabackend.model.dto.UpdateProfileRequest;
import gal.usc.telariabackend.services.AccountDeletionService;
import gal.usc.telariabackend.services.AuthService;
import gal.usc.telariabackend.services.UserService;
import gal.usc.telariabackend.utils.SecurityHelper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class UserController implements UsersApi {

    private final UserService userService;
    private final AuthService authService;
    private final AccountDeletionService accountDeletionService;
    private final SecurityHelper securityHelper;

    public UserController(UserService userService,
                          AuthService authService,
                          AccountDeletionService accountDeletionService,
                          SecurityHelper securityHelper) {
        this.userService = userService;
        this.authService = authService;
        this.accountDeletionService = accountDeletionService;
        this.securityHelper = securityHelper;
    }

    @Override
    public ResponseEntity<OwnProfile> getMyProfile() {
        return ResponseEntity.ok(userService.getProfile(securityHelper.getUserId()));
    }

    @Override
    public ResponseEntity<OwnProfile> updateMyProfile(UpdateProfileRequest updateProfileRequest) {
        return ResponseEntity.ok(userService.updateProfile(
                securityHelper.getUserId(),
                updateProfileRequest.getUsername(),
                updateProfileRequest.getEmail()));
    }

    @Override
    public ResponseEntity<LoginResponse> changeMyPassword(ChangePasswordRequest changePasswordRequest) {
        return ResponseEntity.ok(authService.changePassword(
                securityHelper.getUserId(),
                changePasswordRequest.getCurrentPassword(),
                changePasswordRequest.getNewPassword()));
    }

    @Override
    public ResponseEntity<Void> deleteMyAccount(DeleteAccountRequest deleteAccountRequest) {
        accountDeletionService.deleteAccount(securityHelper.getUserId(), deleteAccountRequest.getPassword());
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<AvatarUploadResponse> initAvatarUpload(AvatarUploadRequest avatarUploadRequest) {
        UUID userId = securityHelper.getUserId();
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.initAvatarUpload(userId));
    }

    @Override
    public ResponseEntity<Void> confirmAvatarUpload() {
        userService.confirmAvatarUpload(securityHelper.getUserId());
        return ResponseEntity.ok().build();
    }

    @Override
    public ResponseEntity<AvatarDownloadResponse> getAvatarDownloadUrl(UUID userId) {
        return ResponseEntity.ok(userService.getAvatarDownloadUrl(userId));
    }
}

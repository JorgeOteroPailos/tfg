package gal.usc.telariabackend.e2e;

import com.fasterxml.jackson.databind.ObjectMapper;
import gal.usc.telariabackend.model.dto.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

import java.net.URI;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class UserE2ETest extends BaseE2ETest {

    private static final String PASSWORD = "pass1234";

    MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private WebApplicationContext context;
    @Autowired private TransactionTemplate tx;
    @Autowired private EntityManager em;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    @BeforeEach
    @AfterAll
    @SuppressWarnings("SqlNoDataSourceInspection")
    void cleanDb() {
        tx.execute(_ -> {
            // UserE2ETest only creates users, but the E2E classes share the same containers,
            // so the cleanup must tolerate rows left by any previously executed class.
            em.createNativeQuery("DELETE FROM expense_beneficiaries").executeUpdate();
            em.createNativeQuery("DELETE FROM expenses").executeUpdate();
            em.createNativeQuery("DELETE FROM events").executeUpdate();
            em.createNativeQuery("DELETE FROM documents").executeUpdate();
            em.createNativeQuery("DELETE FROM ai_chat_messages").executeUpdate();
            em.createNativeQuery("DELETE FROM trip_chat_messages").executeUpdate();
            em.createNativeQuery("DELETE FROM friend_requests").executeUpdate();
            em.createNativeQuery("DELETE FROM friendships").executeUpdate();
            em.createNativeQuery("DELETE FROM trip_members").executeUpdate();
            em.createNativeQuery("DELETE FROM joinrequest").executeUpdate();
            em.createNativeQuery("DELETE FROM invitations").executeUpdate();
            em.createNativeQuery("DELETE FROM trips").executeUpdate();
            em.createNativeQuery("DELETE FROM refreshtokens").executeUpdate();
            em.createNativeQuery("DELETE FROM users").executeUpdate();
            return null;
        });
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private String registerAndObtainToken(String username, String email) throws Exception {
        RegisterRequest body = new RegisterRequest()
                .username(username)
                .email(email)
                .password(PASSWORD);

        MvcResult result = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), LoginResponse.class)
                .getAccessToken();
    }

    private OwnProfile getProfile(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/users/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), OwnProfile.class);
    }

    private int loginStatus(String email, String password) throws Exception {
        return mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest().email(email).password(password))))
                .andReturn().getResponse().getStatus();
    }

    private void uploadBytesToMinio(String uploadUrl, byte[] bytes) throws Exception {
        try (java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient()) {
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(URI.create(uploadUrl))
                    .PUT(java.net.http.HttpRequest.BodyPublishers.ofByteArray(bytes))
                    .build();

            java.net.http.HttpResponse<String> response = client.send(request,
                    java.net.http.HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 400) {
                throw new RuntimeException("Minio upload failed: " + response.statusCode() + "\nBody: " + response.body());
            }
        }
    }

    private static byte[] pngBytes(int width, int height) throws Exception {
        java.awt.image.BufferedImage image =
                new java.awt.image.BufferedImage(width, height, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.awt.Graphics2D g = image.createGraphics();
        g.setColor(java.awt.Color.ORANGE);
        g.fillRect(0, 0, width, height);
        g.dispose();
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private String initAvatarUpload(String token) throws Exception {
        MvcResult result = mockMvc.perform(post("/users/me/avatar")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AvatarUploadRequest().contentType("image/png"))))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), AvatarUploadResponse.class)
                .getUploadUrl();
    }

    // -------------------------------------------------------------------------
    // GET /users/me
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Get profile: authenticated user gets their own data")
    void getProfile_authenticated_returnsOwnData() throws Exception {
        String token = registerAndObtainToken("ana", "ana@test.com");

        OwnProfile profile = getProfile(token);

        assertEquals("ana", profile.getUsername());
        assertEquals("ana@test.com", profile.getEmail());
        assertNotNull(profile.getId());
        assertFalse(profile.getHasAvatar());
    }

    @Test
    @DisplayName("Get profile: unauthenticated returns 401")
    void getProfile_noToken_returns401() throws Exception {
        mockMvc.perform(get("/users/me"))
                .andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------------------------------
    // PATCH /users/me
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Update profile: changing only the username does not require the password")
    void updateProfile_usernameOnly_succeeds() throws Exception {
        String token = registerAndObtainToken("bob", "bob@test.com");

        mockMvc.perform(patch("/users/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProfileRequest().username("bobby"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("bobby"))
                .andExpect(jsonPath("$.email").value("bob@test.com"));

        assertEquals("bobby", getProfile(token).getUsername());
    }

    @Test
    @DisplayName("Update profile: changing the email with the correct password succeeds")
    void updateProfile_emailWithCorrectPassword_succeeds() throws Exception {
        String token = registerAndObtainToken("carol", "carol@test.com");

        mockMvc.perform(patch("/users/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProfileRequest()
                                .email("carol.new@test.com")
                                .currentPassword(PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("carol.new@test.com"));

        assertEquals(200, loginStatus("carol.new@test.com", PASSWORD));
    }

    @Test
    @DisplayName("Update profile: changing the email with a wrong password returns 401")
    void updateProfile_emailWithWrongPassword_returns401() throws Exception {
        String token = registerAndObtainToken("dave", "dave@test.com");

        mockMvc.perform(patch("/users/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProfileRequest()
                                .email("dave.new@test.com")
                                .currentPassword("wrongPassword"))))
                .andExpect(status().isUnauthorized());

        assertEquals("dave@test.com", getProfile(token).getEmail());
    }

    @Test
    @DisplayName("Update profile: changing to an email already in use returns 409")
    void updateProfile_emailAlreadyInUse_returns409() throws Exception {
        registerAndObtainToken("taken", "taken@test.com");
        String token = registerAndObtainToken("eve", "eve@test.com");

        mockMvc.perform(patch("/users/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProfileRequest()
                                .email("taken@test.com")
                                .currentPassword(PASSWORD))))
                .andExpect(status().isConflict());

        assertEquals("eve@test.com", getProfile(token).getEmail());
    }

    @Test
    @DisplayName("Update profile: unauthenticated returns 401")
    void updateProfile_noToken_returns401() throws Exception {
        mockMvc.perform(patch("/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProfileRequest().username("nobody"))))
                .andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------------------------------
    // PUT /users/me/password
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Change password: correct current password swaps the credentials and returns a fresh token")
    void changePassword_correctCurrentPassword_succeeds() throws Exception {
        String token = registerAndObtainToken("frank", "frank@test.com");
        String newPassword = "newPass5678";

        MvcResult result = mockMvc.perform(put("/users/me/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChangePasswordRequest()
                                .currentPassword(PASSWORD)
                                .newPassword(newPassword))))
                .andExpect(status().isOk())
                .andReturn();

        String freshToken = objectMapper.readValue(result.getResponse().getContentAsString(), LoginResponse.class)
                .getAccessToken();
        assertNotNull(freshToken);

        assertEquals(401, loginStatus("frank@test.com", PASSWORD), "Old password should stop working");
        assertEquals(200, loginStatus("frank@test.com", newPassword), "New password should work");
        // The token returned alongside the password change is valid for the current device.
        assertEquals("frank", getProfile(freshToken).getUsername());
    }

    @Test
    @DisplayName("Change password: wrong current password returns 401 and keeps the old credentials")
    void changePassword_wrongCurrentPassword_returns401() throws Exception {
        String token = registerAndObtainToken("grace", "grace@test.com");

        mockMvc.perform(put("/users/me/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChangePasswordRequest()
                                .currentPassword("wrongPassword")
                                .newPassword("whatever1234"))))
                .andExpect(status().isUnauthorized());

        assertEquals(200, loginStatus("grace@test.com", PASSWORD), "Original password should still work");
    }

    @Test
    @DisplayName("Change password: unauthenticated returns 401")
    void changePassword_noToken_returns401() throws Exception {
        mockMvc.perform(put("/users/me/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChangePasswordRequest()
                                .currentPassword(PASSWORD)
                                .newPassword("newPass5678"))))
                .andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------------------------------
    // Avatar: POST /users/me/avatar, POST .../confirm, GET /users/{userId}/avatar
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Avatar: full flow init -> upload -> confirm exposes the avatar and a download URL")
    void avatar_fullFlow_setsAvatarAndExposesDownloadUrl() throws Exception {
        String token = registerAndObtainToken("hugo", "hugo@test.com");
        UUID userId = getProfile(token).getId();

        String uploadUrl = initAvatarUpload(token);
        uploadBytesToMinio(uploadUrl, pngBytes(64, 64));

        mockMvc.perform(post("/users/me/avatar/confirm")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        assertTrue(getProfile(token).getHasAvatar(), "Profile should report an avatar after confirmation");

        MvcResult downloadResult = mockMvc.perform(get("/users/{userId}/avatar", userId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        assertNotNull(objectMapper.readValue(downloadResult.getResponse().getContentAsString(),
                AvatarDownloadResponse.class).getDownloadUrl());
    }

    @Test
    @DisplayName("Avatar: confirming without a prior upload returns 404")
    void avatar_confirmWithoutPendingUpload_returns404() throws Exception {
        String token = registerAndObtainToken("iris", "iris@test.com");

        mockMvc.perform(post("/users/me/avatar/confirm")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Avatar: confirming when the file never reached storage returns 409")
    void avatar_confirmWithoutActualUpload_returns409() throws Exception {
        String token = registerAndObtainToken("jack", "jack@test.com");

        // Init reserves a pending key but we never PUT the bytes to Minio.
        initAvatarUpload(token);

        mockMvc.perform(post("/users/me/avatar/confirm")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Avatar: download URL for a user without an avatar returns 404")
    void avatar_downloadForUserWithoutAvatar_returns404() throws Exception {
        String token = registerAndObtainToken("kate", "kate@test.com");
        UUID userId = getProfile(token).getId();

        mockMvc.perform(get("/users/{userId}/avatar", userId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Avatar: requesting an upload URL while unauthenticated returns 401")
    void avatar_initUploadNoToken_returns401() throws Exception {
        mockMvc.perform(post("/users/me/avatar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AvatarUploadRequest().contentType("image/png"))))
                .andExpect(status().isUnauthorized());
    }
}

package gal.usc.telariabackend.e2e;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@TestMethodOrder(MethodOrderer.DisplayName.class)
class AuthE2ETest {

    MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private WebApplicationContext context;

    // ─── Helpers ────────────────────────────────────────────────────────────────

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    /**
     * Registers a user and returns the access token from the registration response.
     * Reusable in the tests that need an authenticated user.
     */
    private String registerAndObtainToken(String username, String email, String password) throws Exception {
        Map<String, String> body = Map.of(
                "username", username,
                "email", email,
                "password", password
        );

        MvcResult result = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();

        Map<?, ?> response = objectMapper.readValue(result.getResponse().getContentAsString(), Map.class);
        return (String) response.get("accessToken");
    }

    // ─── Register (/auth/register) ─────────────────────────────────────────────

    @Test
    @DisplayName("Register: new user returns 201 and tokens")
    void register_newUser_returnsTokens() throws Exception {
        Map<String, String> body = Map.of(
                "username", "alice",
                "email", "alice@test.com",
                "password", "pass1234"
        );

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty());
    }

    @Test
    @DisplayName("Register: duplicate email returns 409")
    void register_duplicateEmail_returns409() throws Exception {
        registerAndObtainToken("alice", "alice@test.com", "pass1234");

        Map<String, String> body = Map.of(
                "username", "alice2",
                "email", "alice@test.com",
                "password", "otrapass"
        );

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Register: empty body returns 400")
    void register_emptyBody_returns400() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Register: invalid email returns 400")
    void register_invalidEmail_returns400() throws Exception {
        Map<String, String> body = Map.of(
                "username", "bob",
                "email", "esto-no-es-un-email",
                "password", "pass1234"
        );

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
    }

    // ─── Login (/auth/login) ─────────────────────────────────────────────────

    @Test
    @DisplayName("Login: correct credentials return 200 and tokens")
    void login_correctCredentials_returnsTokens() throws Exception {
        registerAndObtainToken("carol", "carol@test.com", "mypassword");

        Map<String, String> body = Map.of(
                "email", "carol@test.com",
                "password", "mypassword"
        );

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty());
    }

    @Test
    @DisplayName("Login: incorrect password returns 401")
    void login_incorrectPassword_returns401() throws Exception {
        registerAndObtainToken("dave", "dave@test.com", "correcta");

        Map<String, String> body = Map.of(
                "email", "dave@test.com",
                "password", "incorrecta"
        );

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Login: non-existent user returns 401")
    void login_nonExistentUser_returns401() throws Exception {
        Map<String, String> body = Map.of(
                "email", "fantasma@test.com",
                "password", "daigual"
        );

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Login: empty body returns 400")
    void login_emptyBody_returns400() throws Exception {
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Login: invalid email returns 400")
    void login_invalidEmail_returns400() throws Exception {
        Map<String, String> body = Map.of(
                "username", "bob",
                "email", "esto-no-es-un-email",
                "password", "pass1234"
        );

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
    }

    // ─── Logout (/auth/logout) ───────────────────────────────────────────────

    @Test
    @DisplayName("Logout: with valid token returns 204")
    void logout_validToken_returns204() throws Exception {
        String token = registerAndObtainToken("eve", "eve@test.com", "pass1234");

        mockMvc.perform(post("/auth/logout")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Logout: without token returns 401")
    void logout_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/auth/logout"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Logout: invalid/expired token returns 401")
    void logout_invalidToken_returns401() throws Exception {
        mockMvc.perform(post("/auth/logout")
                        .header("Authorization", "Bearer token.inventado.invalido"))
                .andExpect(status().isUnauthorized());
    }

    // ─── Users (/users) ───────────────────────────────────────────────────
    //TODO cambiar de controlador o algo??

    @Test
    @DisplayName("GET /users: with valid token returns 200 and list")
    void getUsers_validToken_returnsList() throws Exception {
        String token = registerAndObtainToken("frank", "frank@test.com", "pass1234");

        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                // Al menos frank está en la BD (misma transacción)
                .andExpect(jsonPath("$[*].email", hasItem("frank@test.com")));
    }

    @Test
    @DisplayName("GET /users: without token returns 401")
    void getUsers_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /users: invalid token returns 401")
    void getUsers_invalidToken_returns401() throws Exception {
        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer token.inventado.invalido"))
                .andExpect(status().isUnauthorized());
    }

    // ─── Refresh (/auth/refresh) ─────────────────────────────────────────────────

    private String[] registerAndObtainTokens(String username, String email) throws Exception {
        Map<String, String> body = Map.of(
                "username", username,
                "email", email,
                "password", "pass1234"
        );

        MvcResult result = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();

        Map<?, ?> response = objectMapper.readValue(result.getResponse().getContentAsString(), Map.class);
        return new String[]{
                (String) response.get("accessToken"),
                (String) response.get("refreshToken")
        };
    }

    @Test
    @DisplayName("Refresh: valid token returns 200 and new pair of tokens")
    void refresh_validToken_returnsNewTokens() throws Exception {
        String[] tokens = registerAndObtainTokens("hugo", "hugo@test.com");
        String refreshToken = tokens[1];

        Map<String, String> body = Map.of("refreshToken", refreshToken);

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").value(not(refreshToken))); // token rotado
    }

    @Test
    @DisplayName("Refresh: invalid token returns 401")
    void refresh_invalidToken_returns401() throws Exception {
        Map<String, String> body = Map.of("refreshToken", "token-inventado");

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Refresh: empty body returns 400")
    void refresh_emptyBody_returns400() throws Exception {
        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Refresh: reusing already used token returns 401")
    void refresh_alreadyUsedToken_returns401() throws Exception {
        String[] tokens = registerAndObtainTokens("irene", "irene@test.com");
        String refreshToken = tokens[1];

        Map<String, String> body = Map.of("refreshToken", refreshToken);

        // First use — should work
        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());

        // SSecond use — should fail
        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Refresh: the new accessToken is valid for protected routes")
    void refresh_newAccessToken_worksInProtectedRoutes() throws Exception {
        String[] tokens = registerAndObtainTokens("julia", "julia@test.com");

        Map<String, String> body = Map.of("refreshToken", tokens[1]);

        MvcResult refreshResult = mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();

        String nuevoAccessToken = (String) objectMapper
                .readValue(refreshResult.getResponse().getContentAsString(), Map.class)
                .get("accessToken");

        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + nuevoAccessToken))
                .andExpect(status().isOk());
    }

    // ─── Complete e2e flow ──────────────────────────────────────────────────

    @Test
    @DisplayName("Complete flow: register → login → refresh → get users → logout")
    void flujoCompleto_auth() throws Exception {
        // 1. Register
        registerAndObtainTokens("grace", "grace@test.com");

        // 2. Login with the registered credentials (verifies that the user is saved)
        Map<String, String> loginBody = Map.of(
                "email", "grace@test.com",
                "password", "pass1234"
        );
        MvcResult loginResult = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginBody)))
                .andExpect(status().isOk())
                .andReturn();

        Map<?, ?> loginResponse = objectMapper.readValue(loginResult.getResponse().getContentAsString(), Map.class);
        String accessTokenLogin = (String) loginResponse.get("accessToken");
        String refreshTokenLogin = (String) loginResponse.get("refreshToken");

        // 3. Get users with access token from login
        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + accessTokenLogin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].email", hasItem("grace@test.com")));

        // 4. Refresh — get a new pair of tokens
        MvcResult refreshResult = mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", refreshTokenLogin))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andReturn();

        Map<?, ?> refreshResponse = objectMapper.readValue(refreshResult.getResponse().getContentAsString(), Map.class);
        String nuevoAccessToken = (String) refreshResponse.get("accessToken");
        String nuevoRefreshToken = (String) refreshResponse.get("refreshToken");

        // 5. Check old refresh token no longer works (token rotation)
        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", refreshTokenLogin))))
                .andExpect(status().isUnauthorized());

        // 6. Get users with the new access token
        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + nuevoAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].email", hasItem("grace@test.com")));

        // 7. Logout
        mockMvc.perform(post("/auth/logout")
                        .header("Authorization", "Bearer " + nuevoAccessToken))
                .andExpect(status().isNoContent());

        // 8. Verify that the refresh token obtained in step 4 is invalidated after logout
        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", nuevoRefreshToken))))
                .andExpect(status().isUnauthorized());
    }
}

package gal.usc.telariabackend.e2e;

import com.fasterxml.jackson.databind.ObjectMapper;
import gal.usc.telariabackend.model.dto.*;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@TestMethodOrder(MethodOrderer.DisplayName.class)
class AuthE2ETest {

    MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private WebApplicationContext context;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    private LoginResponse registerAndObtainTokens(String username, String email, String password) throws Exception {
        RegisterRequest body = new RegisterRequest()
                .username(username)
                .email(email)
                .password(password);

        MvcResult result = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), LoginResponse.class);
    }

    private String registerAndObtainToken(String username, String email, String password) throws Exception {
        return registerAndObtainTokens(username, email, password).getAccessToken();
    }

    // Register

    @Test
    @DisplayName("Register: new user returns 201 and tokens")
    void register_newUser_returnsTokens() throws Exception {
        RegisterRequest body = new RegisterRequest()
                .username("pepe")
                .email("pepe@example.com")
                .password("pass1234");

        MvcResult result = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();

        LoginResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), LoginResponse.class);

        assertNotNull(response.getAccessToken());
        assertFalse(response.getAccessToken().isBlank());
        assertNotNull(response.getRefreshToken());
        assertFalse(response.getRefreshToken().isBlank());
    }

    @Test
    @DisplayName("Register: duplicate email returns 409")
    void register_duplicateEmail_returns409() throws Exception {
        registerAndObtainToken("pepe", "pepe@example.com", "pass1234");

        RegisterRequest body = new RegisterRequest()
                .username("pepe2")
                .email("pepe@example.com")
                .password("otrapass");

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
                        .content(objectMapper.writeValueAsString(new RegisterRequest())))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Register: invalid email returns 400")
    void register_invalidEmail_returns400() throws Exception {
        RegisterRequest body = new RegisterRequest()
                .username("lola")
                .email("esto-no-es-un-email")
                .password("pass1234");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
    }

    // Login

    @Test
    @DisplayName("Login: correct credentials return 200 and tokens")
    void login_correctCredentials_returnsTokens() throws Exception {
        registerAndObtainToken("manolo", "manolo@hotmail.com", "pass1234");

        LoginRequest body = new LoginRequest()
                .email("manolo@hotmail.com")
                .password("pass1234");

        MvcResult result = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();

        LoginResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), LoginResponse.class);

        assertNotNull(response.getAccessToken());
        assertFalse(response.getAccessToken().isBlank());
        assertNotNull(response.getRefreshToken());
        assertFalse(response.getRefreshToken().isBlank());
    }

    @Test
    @DisplayName("Login: incorrect password returns 401")
    void login_incorrectPassword_returns401() throws Exception {
        registerAndObtainToken("fran", "fran@gmail.com", "correcta");

        LoginRequest body = new LoginRequest()
                .email("fran@gmail.com")
                .password("incorrecta");

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Login: non-existent user returns 401")
    void login_nonExistentUser_returns401() throws Exception {
        LoginRequest body = new LoginRequest()
                .email("fantasma@example.com")
                .password("daigual");

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
                        .content(objectMapper.writeValueAsString(new LoginRequest())))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Login: invalid email returns 400")
    void login_invalidEmail_returns400() throws Exception {
        LoginRequest body = new LoginRequest()
                .email("esto-no-es-un-email")
                .password("pass1234");

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
    }

    // Logout

    @Test
    @DisplayName("Logout: with valid token returns 204")
    void logout_validToken_returns204() throws Exception {
        String token = registerAndObtainToken("mari", "mari@yahoo.es", "pass1234");

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
    @DisplayName("Logout: invalid token returns 401")
    void logout_invalidToken_returns401() throws Exception {
        mockMvc.perform(post("/auth/logout")
                        .header("Authorization", "Bearer token.inventado.invalido"))
                .andExpect(status().isUnauthorized());
    }

    // Users

    @Test
    @DisplayName("GET /users: with valid token returns 200 and list containing registered user")
    void getUsers_validToken_returnsList() throws Exception {
        String token = registerAndObtainToken("curro", "curro@outlook.com", "pass1234");

        MvcResult result = mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        User[] users = objectMapper.readValue(result.getResponse().getContentAsString(), User[].class);

        assertTrue(users.length > 0);
        boolean found = false;
        for (User u : users) {
            if ("curro@outlook.com".equals(u.getEmail())) {
                found = true;
                break;
            }
        }
        assertTrue(found);
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

    // Refresh

    @Test
    @DisplayName("Refresh: valid token returns 200 and new pair of tokens")
    void refresh_validToken_returnsNewTokens() throws Exception {
        LoginResponse tokens = registerAndObtainTokens("paqui", "paqui@example.com", "pass1234");

        RefreshRequest body = new RefreshRequest().refreshToken(tokens.getRefreshToken());

        MvcResult result = mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();

        RefreshResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), RefreshResponse.class);

        assertNotNull(response.getAccessToken());
        assertFalse(response.getAccessToken().isBlank());
        assertNotNull(response.getRefreshToken());
        assertNotEquals(tokens.getRefreshToken(), response.getRefreshToken());
    }

    @Test
    @DisplayName("Refresh: invalid token returns 401")
    void refresh_invalidToken_returns401() throws Exception {
        RefreshRequest body = new RefreshRequest().refreshToken("token-inventado");

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
                        .content(objectMapper.writeValueAsString(new RefreshRequest())))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Refresh: reusing already used token returns 401")
    void refresh_alreadyUsedToken_returns401() throws Exception {
        LoginResponse tokens = registerAndObtainTokens("rober", "rober@empresa.es", "pass1234");
        RefreshRequest body = new RefreshRequest().refreshToken(tokens.getRefreshToken());

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Refresh: the new accessToken is valid for protected routes")
    void refresh_newAccessToken_worksInProtectedRoutes() throws Exception {
        LoginResponse tokens = registerAndObtainTokens("sole", "sole@correo.com", "pass1234");

        RefreshRequest body = new RefreshRequest().refreshToken(tokens.getRefreshToken());

        MvcResult refreshResult = mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();

        RefreshResponse response = objectMapper.readValue(refreshResult.getResponse().getContentAsString(), RefreshResponse.class);

        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + response.getAccessToken()))
                .andExpect(status().isOk());
    }

    // Flujo completo

    @Test
    @DisplayName("Complete flow: register → login → refresh → get users → logout")
    void flujoCompleto_auth() throws Exception {
        registerAndObtainTokens("kiko", "kiko@example.com", "pass1234");

        LoginRequest loginBody = new LoginRequest()
                .email("kiko@example.com")
                .password("pass1234");

        MvcResult loginResult = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginBody)))
                .andExpect(status().isOk())
                .andReturn();

        LoginResponse loginResponse = objectMapper.readValue(loginResult.getResponse().getContentAsString(), LoginResponse.class);

        MvcResult usersResult = mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + loginResponse.getAccessToken()))
                .andExpect(status().isOk())
                .andReturn();

        User[] users = objectMapper.readValue(usersResult.getResponse().getContentAsString(), User[].class);
        assertTrue(java.util.Arrays.stream(users).anyMatch(u -> "kiko@example.com".equals(u.getEmail())));

        MvcResult refreshResult = mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RefreshRequest().refreshToken(loginResponse.getRefreshToken()))))
                .andExpect(status().isOk())
                .andReturn();

        RefreshResponse refreshResponse = objectMapper.readValue(refreshResult.getResponse().getContentAsString(), RefreshResponse.class);

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RefreshRequest().refreshToken(loginResponse.getRefreshToken()))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + refreshResponse.getAccessToken()))
                .andExpect(status().isOk());

        mockMvc.perform(post("/auth/logout")
                        .header("Authorization", "Bearer " + refreshResponse.getAccessToken()))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RefreshRequest().refreshToken(refreshResponse.getRefreshToken()))))
                .andExpect(status().isUnauthorized());
    }
}
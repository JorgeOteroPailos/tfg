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
@Transactional  // Rollback automático tras cada test → nunca hay colisiones entre tests
@TestMethodOrder(MethodOrderer.DisplayName.class)
class AuthE2ETest {

    MockMvc mockMvc;
    // En vez de @Autowired ObjectMapper objectMapper;
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
     * Registra un usuario y devuelve el accessToken.
     * Reutilizable en los tests que necesitan un usuario ya autenticado.
     */
    private String registrarYObtenerToken(String username, String email, String password) throws Exception {
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

    // ─── Registro (/auth/register) ─────────────────────────────────────────────

    @Test
    @DisplayName("Registro: usuario nuevo devuelve 201 y tokens")
    void registro_usuarioNuevo_devuelveTokens() throws Exception {
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
    @DisplayName("Registro: email duplicado devuelve 409")
    void registro_emailDuplicado_devuelve409() throws Exception {
        registrarYObtenerToken("alice", "alice@test.com", "pass1234");

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
    @DisplayName("Registro: body vacío devuelve 400")
    void registro_bodyVacio_devuelve400() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Registro: email inválido devuelve 400")
    void registro_emailInvalido_devuelve400() throws Exception {
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
    @DisplayName("Login: credenciales correctas devuelven 200 y tokens")
    void login_credencialesCorrectas_devuelveTokens() throws Exception {
        // Registrar dentro del mismo test (misma transacción → disponible para el login)
        registrarYObtenerToken("carol", "carol@test.com", "mypassword");

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
    @DisplayName("Login: contraseña incorrecta devuelve 401")
    void login_passwordIncorrecta_devuelve401() throws Exception {
        registrarYObtenerToken("dave", "dave@test.com", "correcta");

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
    @DisplayName("Login: usuario inexistente devuelve 401")
    void login_usuarioInexistente_devuelve401() throws Exception {
        Map<String, String> body = Map.of(
                "email", "fantasma@test.com",
                "password", "daigual"
        );

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    // ─── Logout (/auth/logout) ───────────────────────────────────────────────

    @Test
    @DisplayName("Logout: con token válido devuelve 204")
    void logout_tokenValido_devuelve204() throws Exception {
        String token = registrarYObtenerToken("eve", "eve@test.com", "pass1234");

        mockMvc.perform(post("/auth/logout")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Logout: sin token devuelve 401")
    void logout_sinToken_devuelve401() throws Exception {
        mockMvc.perform(post("/auth/logout"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Logout: token inválido/expirado devuelve 401")
    void logout_tokenInvalido_devuelve401() throws Exception {
        mockMvc.perform(post("/auth/logout")
                        .header("Authorization", "Bearer token.inventado.invalido"))
                .andExpect(status().isUnauthorized());
    }

    // ─── Usuarios (/users) ───────────────────────────────────────────────────
    //TODO cambiar de controlador o algo??

    @Test
    @DisplayName("GET /users: con token válido devuelve 200 y lista")
    void getUsers_tokenValido_devuelveLista() throws Exception {
        String token = registrarYObtenerToken("frank", "frank@test.com", "pass1234");

        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                // Al menos frank está en la BD (misma transacción)
                .andExpect(jsonPath("$[*].email", hasItem("frank@test.com")));
    }

    @Test
    @DisplayName("GET /users: sin token devuelve 401")
    void getUsers_sinToken_devuelve401() throws Exception {
        mockMvc.perform(get("/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /users: token inválido devuelve 401")
    void getUsers_tokenInvalido_devuelve401() throws Exception {
        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer token.inventado.invalido"))
                .andExpect(status().isUnauthorized());
    }

    // ─── Flujo E2E completo ──────────────────────────────────────────────────

    @Test
    @DisplayName("Flujo completo: registro → login → consulta usuarios → logout")
    void flujoCompleto_registroLoginUsersLogout() throws Exception {
        // 1. Registro
        String tokenRegistro = registrarYObtenerToken("grace", "grace@test.com", "pass1234");

        // 2. Login con las mismas credenciales (comprueba que el usuario quedó guardado)
        Map<String, String> loginBody = Map.of(
                "email", "grace@test.com",
                "password", "pass1234"
        );
        MvcResult loginResult = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginBody)))
                .andExpect(status().isOk())
                .andReturn();

        String tokenLogin = (String) objectMapper
                .readValue(loginResult.getResponse().getContentAsString(), Map.class)
                .get("accessToken");

        // 3. Consultar usuarios con el token del login
        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + tokenLogin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].email", hasItem("grace@test.com")));

        // 4. Logout
        mockMvc.perform(post("/auth/logout")
                        .header("Authorization", "Bearer " + tokenLogin))
                .andExpect(status().isNoContent());

        // 5. Verificar que tras logout el token DE REFRESCO ya no sirve
        //TODO
    }
}

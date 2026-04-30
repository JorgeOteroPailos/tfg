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

    @Test
    @DisplayName("login: body vacío devuelve 400")
    void login_bodyVacio_devuelve400() throws Exception {
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("login: email inválido devuelve 400")
    void login_emailInvalido_devuelve400() throws Exception {
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

    // ─── Refresh (/auth/refresh) ─────────────────────────────────────────────────

    private String[] registrarYObtenerTokens(String username, String email, String password) throws Exception {
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
        return new String[]{
                (String) response.get("accessToken"),
                (String) response.get("refreshToken")
        };
    }

    @Test
    @DisplayName("Refresh: token válido devuelve 200 y par de tokens nuevos")
    void refresh_tokenValido_devuelveTokensNuevos() throws Exception {
        String[] tokens = registrarYObtenerTokens("hugo", "hugo@test.com", "pass1234");
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
    @DisplayName("Refresh: token inválido devuelve 401")
    void refresh_tokenInvalido_devuelve401() throws Exception {
        Map<String, String> body = Map.of("refreshToken", "token-inventado");

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Refresh: body vacío devuelve 400")
    void refresh_bodyVacio_devuelve400() throws Exception {
        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Refresh: reutilizar token ya usado devuelve 401")
    void refresh_tokenYaUsado_devuelve401() throws Exception {
        String[] tokens = registrarYObtenerTokens("irene", "irene@test.com", "pass1234");
        String refreshToken = tokens[1];

        Map<String, String> body = Map.of("refreshToken", refreshToken);

        // Primera vez — válido
        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());

        // Segunda vez con el mismo token — ya invalidado
        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Refresh: el nuevo accessToken es válido para rutas protegidas")
    void refresh_nuevoAccessToken_funcionaEnRutasProtegidas() throws Exception {
        String[] tokens = registrarYObtenerTokens("julia", "julia@test.com", "pass1234");

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

    // ─── Flujo E2E completo ──────────────────────────────────────────────────

    @Test
    @DisplayName("Flujo completo: registro → login → refresh → consulta usuarios → logout")
    void flujoCompleto_registroLoginUsersLogout() throws Exception {
        // 1. Registro
        String[] tokensRegistro = registrarYObtenerTokens("grace", "grace@test.com", "pass1234");
        String refreshTokenRegistro = tokensRegistro[1];

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

        //TODO ver pq hay un avariable sin usar

        Map<?, ?> loginResponse = objectMapper.readValue(loginResult.getResponse().getContentAsString(), Map.class);
        String accessTokenLogin = (String) loginResponse.get("accessToken");
        String refreshTokenLogin = (String) loginResponse.get("refreshToken");

        // 3. Consultar usuarios con el token del login
        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + accessTokenLogin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].email", hasItem("grace@test.com")));

        // 4. Refresh — obtener nuevo par de tokens
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

        // 5. Comprobar que el refresh token viejo ya no sirve
        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", refreshTokenLogin))))
                .andExpect(status().isUnauthorized());

        // 6. Consultar usuarios con el nuevo access token
        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + nuevoAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].email", hasItem("grace@test.com")));

        // 7. Logout
        mockMvc.perform(post("/auth/logout")
                        .header("Authorization", "Bearer " + nuevoAccessToken))
                .andExpect(status().isNoContent());

        // 8. Verificar que tras logout el nuevo refresh token ya no sirve
        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", nuevoRefreshToken))))
                .andExpect(status().isUnauthorized());
    }
}

package gal.usc.telariabackend.e2e;

import com.fasterxml.jackson.databind.ObjectMapper;
import gal.usc.telariabackend.model.AiChatMessage;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
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

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AiChatE2ETest extends BaseE2ETest {

    MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Autowired private WebApplicationContext context;
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
            em.createNativeQuery("DELETE FROM ai_chat_messages").executeUpdate();
            em.createNativeQuery("DELETE FROM trip_members").executeUpdate();
            em.createNativeQuery("DELETE FROM joinrequest").executeUpdate();
            em.createNativeQuery("DELETE FROM invitations").executeUpdate();
            em.createNativeQuery("DELETE FROM trips").executeUpdate();
            em.createNativeQuery("DELETE FROM refreshtokens").executeUpdate();
            em.createNativeQuery("DELETE FROM users").executeUpdate();
            return null;
        });
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private String registerAndObtainToken(String username, String email) throws Exception {
        RegisterRequest body = new RegisterRequest()
                .username(username)
                .email(email)
                .password("pass1234");

        MvcResult result = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), LoginResponse.class)
                .getAccessToken();
    }

    private UUID extractUserIdFromToken(String token) throws Exception {
        String payload = token.split("\\.")[1];
        byte[] decoded = Base64.getUrlDecoder().decode(payload);
        String json = new String(decoded, StandardCharsets.UTF_8);
        return UUID.fromString(objectMapper.readTree(json).get("sub").asText());
    }

    private UUID createTripAndObtainId(String token, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/trips")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateTripRequest().name(name))))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), IdResponse.class).getId();
    }

    private void insertAiChatMessages(UUID tripId, UUID userId) {
        tx.execute(_ -> {
            User u = em.find(User.class, userId);
            Trip t = em.find(Trip.class, tripId);
            em.persist(new AiChatMessage(t, u, AiChatMessage.Role.USER, "¿Qué tenemos planeado?"));
            em.persist(new AiChatMessage(t, u, AiChatMessage.Role.ASSISTANT, "Tienes varios eventos planificados."));
            return null;
        });
    }

    // ── GET /trips/{tripId}/ai-chat ────────────────────────────────────────────

    @Test
    @DisplayName("GET /ai-chat: new trip returns empty history")
    void getAiChatHistory_newTrip_returnsEmptyList() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@test.com");
        UUID tripId = createTripAndObtainId(token, "Trip to Rome");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/ai-chat", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        AiChatHistoryPage page = objectMapper.readValue(
                result.getResponse().getContentAsString(), AiChatHistoryPage.class);

        assertTrue(page.getMessages().isEmpty());
        assertFalse(page.getHasMore());
    }

    @Test
    @DisplayName("GET /ai-chat: returns only messages for the requesting user")
    void getAiChatHistory_withMessages_returnsUserMessages() throws Exception {
        String token = registerAndObtainToken("ana", "ana@test.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTripAndObtainId(token, "Trip to Paris");

        insertAiChatMessages(tripId, userId);

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/ai-chat", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        AiChatHistoryPage page = objectMapper.readValue(
                result.getResponse().getContentAsString(), AiChatHistoryPage.class);
        List<gal.usc.telariabackend.model.dto.AiChatMessage> messages = page.getMessages();

        assertEquals(2, messages.size());
        assertEquals("¿Qué tenemos planeado?", messages.get(0).getContent());
        assertEquals(gal.usc.telariabackend.model.dto.AiChatMessage.RoleEnum.USER, messages.get(0).getRole());
        assertEquals(gal.usc.telariabackend.model.dto.AiChatMessage.RoleEnum.ASSISTANT, messages.get(1).getRole());
    }

    @Test
    @DisplayName("GET /ai-chat: messages are ordered chronologically")
    void getAiChatHistory_withMessages_returnsMessagesInOrder() throws Exception {
        String token = registerAndObtainToken("bob", "bob@test.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTripAndObtainId(token, "Trip to Berlin");

        insertAiChatMessages(tripId, userId);

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/ai-chat", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        AiChatHistoryPage page = objectMapper.readValue(
                result.getResponse().getContentAsString(), AiChatHistoryPage.class);
        List<gal.usc.telariabackend.model.dto.AiChatMessage> messages = page.getMessages();

        assertEquals(2, messages.size());
        // USER message should come before ASSISTANT message
        assertEquals(gal.usc.telariabackend.model.dto.AiChatMessage.RoleEnum.USER, messages.get(0).getRole());
        assertEquals(gal.usc.telariabackend.model.dto.AiChatMessage.RoleEnum.ASSISTANT, messages.get(1).getRole());
    }

    @Test
    @DisplayName("GET /ai-chat: unauthenticated returns 401")
    void getAiChatHistory_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/trips/{tripId}/ai-chat", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /ai-chat: non-member returns 403")
    void getAiChatHistory_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("carol", "carol@test.com");
        String outsiderToken = registerAndObtainToken("dave", "dave@test.com");
        UUID tripId = createTripAndObtainId(ownerToken, "Carol's private trip");

        mockMvc.perform(get("/trips/{tripId}/ai-chat", tripId)
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    // ── POST /trips/{tripId}/ai-chat ───────────────────────────────────────────

    @Test
    @DisplayName("POST /ai-chat: unauthenticated returns 401")
    void sendAiChatMessage_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/trips/{tripId}/ai-chat", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Hello AI\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /ai-chat: member starts SSE stream")
    void sendAiChatMessage_member_startsAsyncSseStream() throws Exception {
        String token = registerAndObtainToken("eve", "eve@test.com");
        UUID tripId = createTripAndObtainId(token, "Eve's Trip");

        mockMvc.perform(post("/trips/{tripId}/ai-chat", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"¿Cuánto hemos gastado?\"}"))
                .andExpect(request().asyncStarted());
    }
}

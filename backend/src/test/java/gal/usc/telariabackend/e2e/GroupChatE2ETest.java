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

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class GroupChatE2ETest extends BaseE2ETest {

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
            em.createNativeQuery("DELETE FROM trip_chat_messages").executeUpdate();
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

    private UUID createTripAndObtainId(String token, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/trips")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateTripRequest().name(name))))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), IdResponse.class).getId();
    }

    private TripChatMessage sendChatMessage(String token, UUID tripId, String content) throws Exception {
        MvcResult result = mockMvc.perform(post("/trips/{tripId}/group-chat", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new SendTripChatMessageRequest().content(content))))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), TripChatMessage.class);
    }

    // ── GET /trips/{tripId}/group-chat ─────────────────────────────────────────

    @Test
    @DisplayName("GET /group-chat: new trip has empty chat history")
    void getHistory_newTrip_returnsEmptyList() throws Exception {
        String token = registerAndObtainToken("alice", "alice@test.com");
        UUID tripId = createTripAndObtainId(token, "Trip to Rome");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/group-chat", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        List<TripChatMessage> messages = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, TripChatMessage.class));

        assertTrue(messages.isEmpty());
    }

    @Test
    @DisplayName("GET /group-chat: sent messages appear in history")
    void getHistory_afterSending_returnsMessages() throws Exception {
        String token = registerAndObtainToken("bob", "bob@test.com");
        UUID tripId = createTripAndObtainId(token, "Trip to Paris");

        sendChatMessage(token, tripId, "First message");
        sendChatMessage(token, tripId, "Second message");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/group-chat", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        List<TripChatMessage> messages = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, TripChatMessage.class));

        assertEquals(2, messages.size());
        assertEquals("First message", messages.get(0).getContent());
        assertEquals("Second message", messages.get(1).getContent());
    }

    @Test
    @DisplayName("GET /group-chat: without token returns 401")
    void getHistory_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/trips/{tripId}/group-chat", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /group-chat: non-member gets 403")
    void getHistory_nonMember_returns403() throws Exception {
        String owner = registerAndObtainToken("carol", "carol@test.com");
        String outsider = registerAndObtainToken("dave", "dave@test.com");
        UUID tripId = createTripAndObtainId(owner, "Carol's private trip");

        mockMvc.perform(get("/trips/{tripId}/group-chat", tripId)
                        .header("Authorization", "Bearer " + outsider))
                .andExpect(status().isForbidden());
    }

    // ── POST /trips/{tripId}/group-chat ────────────────────────────────────────

    @Test
    @DisplayName("POST /group-chat: returns 201 with full message DTO")
    void sendMessage_member_returns201WithMessageFields() throws Exception {
        String token = registerAndObtainToken("eve", "eve@test.com");
        UUID tripId = createTripAndObtainId(token, "Eve's Trip");

        TripChatMessage msg = sendChatMessage(token, tripId, "Hello everyone!");

        assertNotNull(msg.getId());
        assertEquals("Hello everyone!", msg.getContent());
        assertEquals("eve", msg.getSenderUsername());
        assertNotNull(msg.getSenderId());
        assertNotNull(msg.getTimestamp());
    }

    @Test
    @DisplayName("POST /group-chat: message appears in history after sending")
    void sendMessage_appearsInHistoryAfterSend() throws Exception {
        String token = registerAndObtainToken("frank", "frank@test.com");
        UUID tripId = createTripAndObtainId(token, "Frank's Trip");

        TripChatMessage sent = sendChatMessage(token, tripId, "Persist me!");

        MvcResult historyResult = mockMvc.perform(get("/trips/{tripId}/group-chat", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        List<TripChatMessage> history = objectMapper.readValue(
                historyResult.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, TripChatMessage.class));

        assertEquals(1, history.size());
        assertEquals(sent.getId(), history.getFirst().getId());
        assertEquals("Persist me!", history.getFirst().getContent());
    }

    @Test
    @DisplayName("POST /group-chat: without token returns 401")
    void sendMessage_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/trips/{tripId}/group-chat", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new SendTripChatMessageRequest().content("Hello"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /group-chat: non-member gets 403")
    void sendMessage_nonMember_returns403() throws Exception {
        String owner = registerAndObtainToken("grace", "grace@test.com");
        String outsider = registerAndObtainToken("henry", "henry@test.com");
        UUID tripId = createTripAndObtainId(owner, "Grace's trip");

        mockMvc.perform(post("/trips/{tripId}/group-chat", tripId)
                        .header("Authorization", "Bearer " + outsider)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new SendTripChatMessageRequest().content("Infiltrating!"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /group-chat: empty content returns 400")
    void sendMessage_emptyContent_returns400() throws Exception {
        String token = registerAndObtainToken("iris", "iris@test.com");
        UUID tripId = createTripAndObtainId(token, "Iris Trip");

        mockMvc.perform(post("/trips/{tripId}/group-chat", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new SendTripChatMessageRequest().content(""))))
                .andExpect(status().isBadRequest());
    }

    // ── GET /trips/{tripId}/group-chat/stream ──────────────────────────────────

    @Test
    @DisplayName("GET /group-chat/stream: member opens SSE stream with correct content type")
    void subscribeStream_member_startsAsyncWithEventStreamContentType() throws Exception {
        String token = registerAndObtainToken("jake", "jake@test.com");
        UUID tripId = createTripAndObtainId(token, "Jake's Trip");

        mockMvc.perform(get("/trips/{tripId}/group-chat/stream", tripId)
                        .header("Authorization", "Bearer " + token)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted());
    }

    @Test
    @DisplayName("GET /group-chat/stream: without token returns 401")
    void subscribeStream_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/trips/{tripId}/group-chat/stream", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /group-chat/stream: non-member gets 403")
    void subscribeStream_nonMember_returns403() throws Exception {
        String owner = registerAndObtainToken("lisa", "lisa@test.com");
        String outsider = registerAndObtainToken("mike", "mike@test.com");
        UUID tripId = createTripAndObtainId(owner, "Lisa's trip");

        mockMvc.perform(get("/trips/{tripId}/group-chat/stream", tripId)
                        .header("Authorization", "Bearer " + outsider))
                .andExpect(status().isForbidden());
    }

    // ── Complete flow ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("Complete flow: two members exchange messages visible in each other's history")
    void completeFlow_twoMembersChat() throws Exception {
        String alice = registerAndObtainToken("alice2", "alice2@test.com");
        String bob = registerAndObtainToken("bob2", "bob2@test.com");
        UUID tripId = createTripAndObtainId(alice, "Shared Trip");

        // Invite bob: alice invites, bob accepts
        mockMvc.perform(post("/users/{userId}/invitations", extractUserIdFromToken(bob))
                        .header("Authorization", "Bearer " + alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateInvitationRequest().tripId(tripId))))
                .andExpect(status().isNoContent());

        MvcResult invitationsResult = mockMvc.perform(get("/users/me/invitations")
                        .header("Authorization", "Bearer " + bob))
                .andExpect(status().isOk())
                .andReturn();

        List<InvitationSummary> invitations = objectMapper.readValue(
                invitationsResult.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, InvitationSummary.class));

        UUID invitationId = invitations.getFirst().getId();
        mockMvc.perform(delete("/users/me/invitations/{invitationId}", invitationId)
                        .header("Authorization", "Bearer " + bob)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResolveJoinRequest().accepted(true))))
                .andExpect(status().isOk());

        // Both send a message
        sendChatMessage(alice, tripId, "Hey Bob!");
        sendChatMessage(bob, tripId, "Hey Alice!");

        // Both can see the full history
        for (String token : List.of(alice, bob)) {
            MvcResult result = mockMvc.perform(get("/trips/{tripId}/group-chat", tripId)
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andReturn();

            List<TripChatMessage> history = objectMapper.readValue(
                    result.getResponse().getContentAsString(),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, TripChatMessage.class));

            assertEquals(2, history.size());
            assertEquals("Hey Bob!", history.get(0).getContent());
            assertEquals("Hey Alice!", history.get(1).getContent());
        }
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private UUID extractUserIdFromToken(String token) throws Exception {
        String payload = token.split("\\.")[1];
        byte[] decoded = java.util.Base64.getUrlDecoder().decode(payload);
        String json = new String(decoded, java.nio.charset.StandardCharsets.UTF_8);
        return UUID.fromString(objectMapper.readTree(json).get("sub").asText());
    }
}

package gal.usc.telariabackend.e2e;

import com.fasterxml.jackson.databind.ObjectMapper;
import gal.usc.telariabackend.model.dto.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class FriendE2ETest extends BaseE2ETest {

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
        String sub = objectMapper.readTree(json).get("sub").asText();
        return UUID.fromString(sub);
    }

    private void sendFriendRequest(String senderToken, UUID receiverId) throws Exception {
        mockMvc.perform(post("/users/{userId}/friend-requests", receiverId)
                        .header("Authorization", "Bearer " + senderToken))
                .andExpect(status().isNoContent());
    }

    private List<FriendRequestSummary> getMyFriendRequests(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/users/me/friend-requests")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readValue(result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, FriendRequestSummary.class));
    }

    private List<UserProfile> getMyFriends(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/users/me/friends")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readValue(result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, UserProfile.class));
    }

    private void resolve(String token, UUID requestId, boolean accepted) throws Exception {
        ResolveFriendRequest body = new ResolveFriendRequest().accepted(accepted);
        mockMvc.perform(delete("/users/me/friend-requests/{requestId}", requestId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isNoContent());
    }

    // -------------------------------------------------------------------------
    // Send / receive friend requests
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Send friend request: appears in the receiver's pending list")
    void sendFriendRequest_appearsInReceiverList() throws Exception {
        String aliceToken = registerAndObtainToken("alice", "alice.fr@test.com");
        String bobToken = registerAndObtainToken("bob", "bob.fr@test.com");
        UUID bobId = extractUserIdFromToken(bobToken);

        sendFriendRequest(aliceToken, bobId);

        List<FriendRequestSummary> bobRequests = getMyFriendRequests(bobToken);
        assertEquals(1, bobRequests.size());
        assertEquals("alice", bobRequests.getFirst().getSender().getUsername());

        // The request is one-directional: it does not show up in the sender's list
        assertTrue(getMyFriendRequests(aliceToken).isEmpty());
    }

    @Test
    @DisplayName("Send friend request: to a non-existent user returns 404")
    void sendFriendRequest_toUnknownUser_returns404() throws Exception {
        String aliceToken = registerAndObtainToken("alice", "alice.nf@test.com");

        mockMvc.perform(post("/users/{userId}/friend-requests", UUID.randomUUID())
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Send friend request: to yourself returns 409")
    void sendFriendRequest_toSelf_returns409() throws Exception {
        String aliceToken = registerAndObtainToken("alice", "alice.self@test.com");
        UUID aliceId = extractUserIdFromToken(aliceToken);

        mockMvc.perform(post("/users/{userId}/friend-requests", aliceId)
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Send friend request: duplicate in the same direction returns 409")
    void sendFriendRequest_duplicate_returns409() throws Exception {
        String aliceToken = registerAndObtainToken("alice", "alice.dup@test.com");
        String bobToken = registerAndObtainToken("bob", "bob.dup@test.com");
        UUID bobId = extractUserIdFromToken(bobToken);

        sendFriendRequest(aliceToken, bobId);

        mockMvc.perform(post("/users/{userId}/friend-requests", bobId)
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Send friend request: reverse request while one is pending returns 409")
    void sendFriendRequest_reverseWhilePending_returns409() throws Exception {
        String aliceToken = registerAndObtainToken("alice", "alice.rev@test.com");
        String bobToken = registerAndObtainToken("bob", "bob.rev@test.com");
        UUID aliceId = extractUserIdFromToken(aliceToken);
        UUID bobId = extractUserIdFromToken(bobToken);

        // Alice -> Bob pending; Bob trying to send back must be rejected
        sendFriendRequest(aliceToken, bobId);

        mockMvc.perform(post("/users/{userId}/friend-requests", aliceId)
                        .header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isConflict());
    }

    // -------------------------------------------------------------------------
    // Resolve friend requests
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Accept friend request: both users become friends and the request is gone")
    void acceptFriendRequest_makesBothFriends() throws Exception {
        String aliceToken = registerAndObtainToken("alice", "alice.acc@test.com");
        String bobToken = registerAndObtainToken("bob", "bob.acc@test.com");
        UUID aliceId = extractUserIdFromToken(aliceToken);
        UUID bobId = extractUserIdFromToken(bobToken);

        sendFriendRequest(aliceToken, bobId);
        UUID requestId = getMyFriendRequests(bobToken).getFirst().getId();

        resolve(bobToken, requestId, true);

        // Friendship is symmetric: visible from both sides
        List<UserProfile> aliceFriends = getMyFriends(aliceToken);
        List<UserProfile> bobFriends = getMyFriends(bobToken);
        assertEquals(1, aliceFriends.size());
        assertEquals(bobId, aliceFriends.getFirst().getId());
        assertEquals(1, bobFriends.size());
        assertEquals(aliceId, bobFriends.getFirst().getId());

        // The pending request has been consumed
        assertTrue(getMyFriendRequests(bobToken).isEmpty());
    }

    @Test
    @DisplayName("Reject friend request: request is removed and no friendship is created")
    void rejectFriendRequest_removesRequestWithoutFriendship() throws Exception {
        String aliceToken = registerAndObtainToken("alice", "alice.rej@test.com");
        String bobToken = registerAndObtainToken("bob", "bob.rej@test.com");
        UUID bobId = extractUserIdFromToken(bobToken);

        sendFriendRequest(aliceToken, bobId);
        UUID requestId = getMyFriendRequests(bobToken).getFirst().getId();

        resolve(bobToken, requestId, false);

        assertTrue(getMyFriendRequests(bobToken).isEmpty());
        assertTrue(getMyFriends(aliceToken).isEmpty());
        assertTrue(getMyFriends(bobToken).isEmpty());
    }

    @Test
    @DisplayName("Send friend request: to an existing friend returns 409")
    void sendFriendRequest_toExistingFriend_returns409() throws Exception {
        String aliceToken = registerAndObtainToken("alice", "alice.exf@test.com");
        String bobToken = registerAndObtainToken("bob", "bob.exf@test.com");
        UUID aliceId = extractUserIdFromToken(aliceToken);
        UUID bobId = extractUserIdFromToken(bobToken);

        sendFriendRequest(aliceToken, bobId);
        UUID requestId = getMyFriendRequests(bobToken).getFirst().getId();
        resolve(bobToken, requestId, true);

        mockMvc.perform(post("/users/{userId}/friend-requests", aliceId)
                        .header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Resolve friend request: cannot resolve a request addressed to someone else")
    void resolveFriendRequest_notYourRequest_returns403() throws Exception {
        String aliceToken = registerAndObtainToken("alice", "alice.403@test.com");
        String bobToken = registerAndObtainToken("bob", "bob.403@test.com");
        String eveToken = registerAndObtainToken("eve", "eve.403@test.com");
        UUID bobId = extractUserIdFromToken(bobToken);

        sendFriendRequest(aliceToken, bobId);
        UUID requestId = getMyFriendRequests(bobToken).getFirst().getId();

        ResolveFriendRequest body = new ResolveFriendRequest().accepted(true);
        mockMvc.perform(delete("/users/me/friend-requests/{requestId}", requestId)
                        .header("Authorization", "Bearer " + eveToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    // -------------------------------------------------------------------------
    // Remove friend
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Remove friend: friendship disappears for both users")
    void removeFriend_removesForBothSides() throws Exception {
        String aliceToken = registerAndObtainToken("alice", "alice.rm@test.com");
        String bobToken = registerAndObtainToken("bob", "bob.rm@test.com");
        UUID aliceId = extractUserIdFromToken(aliceToken);
        UUID bobId = extractUserIdFromToken(bobToken);

        sendFriendRequest(aliceToken, bobId);
        UUID requestId = getMyFriendRequests(bobToken).getFirst().getId();
        resolve(bobToken, requestId, true);

        mockMvc.perform(delete("/users/me/friends/{friendId}", bobId)
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isNoContent());

        assertTrue(getMyFriends(aliceToken).isEmpty());
        assertTrue(getMyFriends(bobToken).isEmpty());

        // Removing again is now a 404 (friendship no longer exists)
        mockMvc.perform(delete("/users/me/friends/{friendId}", bobId)
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Endpoints require authentication")
    void endpoints_requireAuthentication() throws Exception {
        mockMvc.perform(get("/users/me/friends"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/users/me/friend-requests"))
                .andExpect(status().isUnauthorized());
    }
}

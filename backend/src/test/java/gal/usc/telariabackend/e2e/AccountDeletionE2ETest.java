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

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AccountDeletionE2ETest extends BaseE2ETest {

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
            em.createNativeQuery("DELETE FROM expense_beneficiaries").executeUpdate();
            em.createNativeQuery("DELETE FROM expenses").executeUpdate();
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

    private UUID extractUserIdFromToken(String token) throws Exception {
        String payload = token.split("\\.")[1];
        String json = new String(Base64.getUrlDecoder().decode(payload), StandardCharsets.UTF_8);
        return UUID.fromString(objectMapper.readTree(json).get("sub").asText());
    }

    private UUID createTrip(String token, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/trips")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateTripRequest().name(name))))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), IdResponse.class).getId();
    }

    private UUID createExpense(String token, UUID tripId, UUID payerId, List<UUID> beneficiaryIds,
                               double amount, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateExpenseRequest()
                                .amount(amount)
                                .name(name)
                                .payerId(payerId)
                                .beneficiaryIds(beneficiaryIds))))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), IdResponse.class).getId();
    }

    private void joinTrip(String guestToken, String memberToken, UUID tripId) throws Exception {
        mockMvc.perform(post("/trips/{tripId}/join-requests", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isNoContent());

        MvcResult result = mockMvc.perform(get("/trips/{tripId}", tripId)
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andReturn();

        TripDetail detail = objectMapper.readValue(result.getResponse().getContentAsString(), TripDetail.class);
        UUID requestId = detail.getPendingRequests().getFirst().getId();

        mockMvc.perform(delete("/trips/{tripId}/join-requests/{requestId}", tripId, requestId)
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResolveJoinRequest().accepted(true))))
                .andExpect(status().isNoContent());
    }

    private int loginStatus(String email) throws Exception {
        return mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest().email(email).password(PASSWORD))))
                .andReturn().getResponse().getStatus();
    }

    // -------------------------------------------------------------------------
    // DELETE /users/me
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Delete account: correct password returns 204 and credentials stop working")
    void deleteAccount_correctPassword_returns204() throws Exception {
        String token = registerAndObtainToken("solo", "solo.del@test.com");

        mockMvc.perform(delete("/users/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteAccountRequest().password(PASSWORD))))
                .andExpect(status().isNoContent());

        assertEquals(401, loginStatus("solo.del@test.com"),
                "Deleted account should no longer be able to log in");
    }

    @Test
    @DisplayName("Delete account: wrong password returns 401 and the account survives")
    void deleteAccount_wrongPassword_returns401() throws Exception {
        String token = registerAndObtainToken("keep", "keep.del@test.com");

        mockMvc.perform(delete("/users/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteAccountRequest().password("wrongPassword"))))
                .andExpect(status().isUnauthorized());

        assertEquals(200, loginStatus("keep.del@test.com"),
                "Account should still exist after a failed deletion");
    }

    @Test
    @DisplayName("Delete account: unauthenticated returns 401")
    void deleteAccount_noToken_returns401() throws Exception {
        mockMvc.perform(delete("/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteAccountRequest().password(PASSWORD))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Delete account: sole member's trip and its expenses are deleted (cascade)")
    void deleteAccount_soleMemberWithExpense_succeeds() throws Exception {
        String token = registerAndObtainToken("lonely", "lonely.del@test.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje en solitario");
        createExpense(token, tripId, userId, List.of(userId), 42.0, "Cena solo");

        mockMvc.perform(delete("/users/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteAccountRequest().password(PASSWORD))))
                .andExpect(status().isNoContent());

        assertEquals(401, loginStatus("lonely.del@test.com"));
    }

    @Test
    @DisplayName("Delete account: in a shared trip the user's footprint is wiped but the trip survives")
    void deleteAccount_sharedTrip_wipesFootprintTripSurvives() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.del@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.del@test.com");
        UUID ownerId = extractUserIdFromToken(ownerToken);
        UUID guestId = extractUserIdFromToken(guestToken);
        UUID tripId = createTrip(ownerToken, "Viaje compartido");
        joinTrip(guestToken, ownerToken, tripId);

        // Expense owned by the guest (payer + creator) -> must disappear entirely.
        UUID guestExpenseId = createExpense(guestToken, tripId, guestId, List.of(ownerId, guestId), 60.0, "Cena invitado");
        // Expense owned by the owner where the guest is only a beneficiary -> must survive.
        UUID ownerExpenseId = createExpense(ownerToken, tripId, ownerId, List.of(ownerId, guestId), 40.0, "Taxi propietario");

        mockMvc.perform(delete("/users/me")
                        .header("Authorization", "Bearer " + guestToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteAccountRequest().password(PASSWORD))))
                .andExpect(status().isNoContent());

        // The trip is still accessible to the remaining member.
        mockMvc.perform(get("/trips/{tripId}", tripId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        MvcResult expensesResult = mockMvc.perform(get("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andReturn();

        String expensesJson = expensesResult.getResponse().getContentAsString();
        assertFalse(expensesJson.contains(guestExpenseId.toString()),
                "The deleted user's own expense should be gone");
        assertTrue(expensesJson.contains(ownerExpenseId.toString()),
                "Another member's expense should survive");
    }
}

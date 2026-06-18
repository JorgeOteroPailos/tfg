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

class ExpenseE2ETest extends BaseE2ETest{

    MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private TransactionTemplate tx;
    @Autowired
    private EntityManager em;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    //Must clean DB like this since @transactional will fail with expenses lazy fetching
    @BeforeEach
    @SuppressWarnings("SqlNoDataSourceInspection")
    @AfterAll
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

    // Helpers

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

    private UUID createTrip(String token, String name) throws Exception {
        CreateTripRequest body = new CreateTripRequest().name(name);

        MvcResult result = mockMvc.perform(post("/trips")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), IdResponse.class)
                .getId();
    }

    private UUID createExpense(String token, UUID tripId, UUID payerId, List<UUID> beneficiaryIds, double amount, String name) throws Exception {
        CreateExpenseRequest body = new CreateExpenseRequest()
                .amount(amount)
                .name(name)
                .payerId(payerId)
                .beneficiaryIds(beneficiaryIds);

        MvcResult result = mockMvc.perform(post("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), IdResponse.class)
                .getId();
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

    // POST /trips/{tripId}/expenses

    @Test
    @DisplayName("Create expense: member can create an expense")
    void createExpense_asMember_returns201WithId() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje a Roma");

        MvcResult result = mockMvc.perform(post("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateExpenseRequest()
                                .amount(30.0)
                                .name("Cena")
                                .payerId(userId)
                                .beneficiaryIds(List.of(userId)))))
                .andExpect(status().isCreated())
                .andReturn();

        IdResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), IdResponse.class);
        assertNotNull(response.getId());
    }

    @Test
    @DisplayName("Create expense: non-member returns 403")
    void createExpense_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("pepe", "pepe@example.com");
        String outsiderToken = registerAndObtainToken("manolo", "manolo@hotmail.com");
        UUID outsiderId = extractUserIdFromToken(outsiderToken);
        UUID tripId = createTrip(ownerToken, "Viaje a París");

        mockMvc.perform(post("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateExpenseRequest()
                                .amount(30.0)
                                .name("Cena")
                                .payerId(outsiderId)
                                .beneficiaryIds(List.of(outsiderId)))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Create expense: unauthenticated returns 401")
    void createExpense_noToken_returns401() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje a Berlín");

        mockMvc.perform(post("/trips/{tripId}/expenses", tripId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateExpenseRequest()
                                .amount(30.0)
                                .name("Cena")
                                .payerId(userId)
                                .beneficiaryIds(List.of(userId)))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Create expense: empty body returns 400")
    void createExpense_emptyBody_returns400() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Amsterdam");

        mockMvc.perform(post("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateExpenseRequest())))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Create expense: payer not a member returns 403")
    void createExpense_payerNotMember_returns403() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje a Praga");

        mockMvc.perform(post("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateExpenseRequest()
                                .amount(30.0)
                                .name("Cena")
                                .payerId(UUID.randomUUID())
                                .beneficiaryIds(List.of(userId)))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Create expense: beneficiary not a member returns 403")
    void createExpense_beneficiaryNotMember_returns403() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje a Viena");

        mockMvc.perform(post("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateExpenseRequest()
                                .amount(30.0)
                                .name("Cena")
                                .payerId(userId)
                                .beneficiaryIds(List.of(userId, UUID.randomUUID())))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Create expense: non-positive amount returns 400")
    void createExpense_nonPositiveAmount_returns400() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje a Oslo");

        mockMvc.perform(post("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateExpenseRequest()
                                .amount(0.0)
                                .name("Cena")
                                .payerId(userId)
                                .beneficiaryIds(List.of(userId)))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateExpenseRequest()
                                .amount(-5.0)
                                .name("Cena")
                                .payerId(userId)
                                .beneficiaryIds(List.of(userId)))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Create expense: empty beneficiaries returns 400")
    void createExpense_emptyBeneficiaries_returns400() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje a Berlin");

        mockMvc.perform(post("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateExpenseRequest()
                                .amount(30.0)
                                .name("Cena")
                                .payerId(userId)
                                .beneficiaryIds(List.of()))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Create settlement: paying yourself returns 403")
    void createSettlement_payToSelf_returns403() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje a Lisboa");

        mockMvc.perform(post("/trips/{tripId}/settlements", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateSettlementRequest()
                                .toId(userId)
                                .amount(10.0))))
                .andExpect(status().isForbidden());
    }

    private ExpenseDetail getExpenseDetail(String token, UUID tripId, UUID expenseId) throws Exception {
        MvcResult result = mockMvc.perform(get("/trips/{tripId}/expenses/{expenseId}", tripId, expenseId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readValue(result.getResponse().getContentAsString(), ExpenseDetail.class);
    }

    // GET /trips/{tripId}/expenses

    @Test
    @DisplayName("List expenses: member gets list of expenses")
    void listExpenses_asMember_returns200WithList() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje a Budapest");

        createExpense(token, tripId, userId, List.of(userId), 30.0, "Cena");
        createExpense(token, tripId, userId, List.of(userId), 50.0, "Hotel");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        ExpenseSummary[] expenses = objectMapper.readValue(
                result.getResponse().getContentAsString(), ExpenseSummary[].class);

        assertEquals(2, expenses.length);
    }

    @Test
    @DisplayName("List expenses: no expenses returns empty list")
    void listExpenses_noExpenses_returnsEmptyList() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Cracovia");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        ExpenseSummary[] expenses = objectMapper.readValue(
                result.getResponse().getContentAsString(), ExpenseSummary[].class);

        assertEquals(0, expenses.length);
    }

    @Test
    @DisplayName("List expenses: non-member returns 403")
    void listExpenses_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("pepe", "pepe@example.com");
        String outsiderToken = registerAndObtainToken("manolo", "manolo@hotmail.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Varsovia");

        mockMvc.perform(get("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("List expenses: unauthenticated returns 401")
    void listExpenses_noToken_returns401() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Tallin");

        mockMvc.perform(get("/trips/{tripId}/expenses", tripId))
                .andExpect(status().isUnauthorized());
    }

    // DELETE /trips/{tripId}/expenses/{expenseId}

    @Test
    @DisplayName("Delete expense: member can delete an expense")
    void deleteExpense_asMember_returns204() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje a Sofía");
        UUID expenseId = createExpense(token, tripId, userId, List.of(userId), 30.0, "Cena");

        mockMvc.perform(delete("/trips/{tripId}/expenses/{expenseId}", tripId, expenseId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Delete expense: after deletion expense is no longer listed")
    void deleteExpense_expenseDisappearsFromList() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje a Atenas");
        UUID expenseId = createExpense(token, tripId, userId, List.of(userId), 30.0, "Cena");

        mockMvc.perform(delete("/trips/{tripId}/expenses/{expenseId}", tripId, expenseId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/expenses", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        ExpenseSummary[] expenses = objectMapper.readValue(
                result.getResponse().getContentAsString(), ExpenseSummary[].class);

        assertEquals(0, expenses.length);
    }

    @Test
    @DisplayName("Delete expense: non-member returns 403")
    void deleteExpense_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("pepe", "pepe@example.com");
        String outsiderToken = registerAndObtainToken("manolo", "manolo@hotmail.com");
        UUID ownerId = extractUserIdFromToken(ownerToken);
        UUID tripId = createTrip(ownerToken, "Viaje a Dubrovnik");
        UUID expenseId = createExpense(ownerToken, tripId, ownerId, List.of(ownerId), 30.0, "Cena");

        mockMvc.perform(delete("/trips/{tripId}/expenses/{expenseId}", tripId, expenseId)
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Delete expense: unauthenticated returns 401")
    void deleteExpense_noToken_returns401() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje a Kotor");
        UUID expenseId = createExpense(token, tripId, userId, List.of(userId), 30.0, "Cena");

        mockMvc.perform(delete("/trips/{tripId}/expenses/{expenseId}", tripId, expenseId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Delete expense: expense from another trip returns 403")
    void deleteExpense_expenseFromAnotherTrip_returns403() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId1 = createTrip(token, "Viaje a Lisboa");
        UUID tripId2 = createTrip(token, "Viaje a Oporto");
        UUID expenseId = createExpense(token, tripId1, userId, List.of(userId), 30.0, "Cena");

        mockMvc.perform(delete("/trips/{tripId}/expenses/{expenseId}", tripId2, expenseId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    // GET /trips/{tripId}/expenses/{expenseId}

    @Test
    @DisplayName("Get expense: member gets expense detail")
    void getExpense_asMember_returns200WithDetail() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje a Florencia");
        UUID expenseId = createExpense(token, tripId, userId, List.of(userId), 45.0, "Museo");

        ExpenseDetail detail = getExpenseDetail(token, tripId, expenseId);

        assertNotNull(detail);
        assertNotNull(detail.getAmount());
        assertEquals(expenseId, detail.getId());
        assertEquals(45.0, detail.getAmount(), 0.001);
        assertEquals(userId, detail.getPayerId());
        assertEquals("Museo", detail.getName());
        assertTrue(detail.getBeneficiaryIds().contains(userId));
    }

    @Test
    @DisplayName("Get expense: non-member returns 403")
    void getExpense_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("pepe", "pepe@example.com");
        String outsiderToken = registerAndObtainToken("manolo", "manolo@hotmail.com");
        UUID ownerId = extractUserIdFromToken(ownerToken);
        UUID tripId = createTrip(ownerToken, "Viaje a Génova");
        UUID expenseId = createExpense(ownerToken, tripId, ownerId, List.of(ownerId), 30.0, "Cena");

        mockMvc.perform(get("/trips/{tripId}/expenses/{expenseId}", tripId, expenseId)
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Get expense: unauthenticated returns 401")
    void getExpense_noToken_returns401() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId = createTrip(token, "Viaje a Turín");
        UUID expenseId = createExpense(token, tripId, userId, List.of(userId), 30.0, "Cena");

        mockMvc.perform(get("/trips/{tripId}/expenses/{expenseId}", tripId, expenseId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Get expense: expense not found returns 404")
    void getExpense_expenseNotFound_returns404() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Bolonia");

        mockMvc.perform(get("/trips/{tripId}/expenses/{expenseId}", tripId, UUID.randomUUID())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Get expense: expense from another trip returns 404")
    void getExpense_expenseFromAnotherTrip_returns404() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID userId = extractUserIdFromToken(token);
        UUID tripId1 = createTrip(token, "Viaje a Verona");
        UUID tripId2 = createTrip(token, "Viaje a Módena");
        UUID expenseId = createExpense(token, tripId1, userId, List.of(userId), 30.0, "Cena");

        mockMvc.perform(get("/trips/{tripId}/expenses/{expenseId}", tripId2, expenseId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    // GET /trips/{tripId}/balances

    @Test
    @DisplayName("Get balances: member gets balances and settlements")
    void getBalances_asMember_returns200WithBalancesInfo() throws Exception {
        String pepeToken = registerAndObtainToken("pepe", "pepe@example.com");
        String manoloToken = registerAndObtainToken("manolo", "manolo@hotmail.com");
        UUID pepeId = extractUserIdFromToken(pepeToken);
        UUID manoloId = extractUserIdFromToken(manoloToken);
        UUID tripId = createTrip(pepeToken, "Viaje a Nápoles");

        joinTrip(manoloToken, pepeToken, tripId);

        createExpense(pepeToken, tripId, pepeId, List.of(pepeId, manoloId), 60.0, "Cena");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/balances", tripId)
                        .header("Authorization", "Bearer " + pepeToken))
                .andExpect(status().isOk())
                .andReturn();

        BalancesInfo balances = objectMapper.readValue(
                result.getResponse().getContentAsString(), BalancesInfo.class);

        assertEquals(1, balances.getSettlements().size());
        var firstSettlement = balances.getSettlements().getFirst();
        assertNotNull(firstSettlement.getAmount());
        assertEquals(30.0, firstSettlement.getAmount(), 0.01);
        assertEquals(manoloId, firstSettlement.getFromId());
        assertEquals(pepeId, firstSettlement.getToId());
    }

    @Test
    @DisplayName("Get balances: no expenses returns empty settlements and balances")
    void getBalances_noExpenses_returnsEmpty() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Estocolmo");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/balances", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        BalancesInfo balances = objectMapper.readValue(
                result.getResponse().getContentAsString(), BalancesInfo.class);

        assertTrue(balances.getSettlements().isEmpty());
        assertTrue(balances.getBalances().isEmpty());
    }

    @Test
    @DisplayName("Get balances: non-member returns 403")
    void getBalances_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("pepe", "pepe@example.com");
        String outsiderToken = registerAndObtainToken("manolo", "manolo@hotmail.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Oslo");

        mockMvc.perform(get("/trips/{tripId}/balances", tripId)
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Get balances: unauthenticated returns 401")
    void getBalances_noToken_returns401() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Helsinki");

        mockMvc.perform(get("/trips/{tripId}/balances", tripId))
                .andExpect(status().isUnauthorized());
    }

    // Flujo completo

    @Test
    @DisplayName("Complete flow: create expenses -> check balances -> delete expense -> balances update")
    void completeFlow_expensesAndBalances() throws Exception {
        String pepeToken = registerAndObtainToken("pepe", "pepe@example.com");
        String manoloToken = registerAndObtainToken("manolo", "manolo@hotmail.com");
        UUID pepeId = extractUserIdFromToken(pepeToken);
        UUID manoloId = extractUserIdFromToken(manoloToken);
        UUID tripId = createTrip(pepeToken, "Viaje a Sarajevo");

        joinTrip(manoloToken, pepeToken, tripId);

        UUID expense1Id = createExpense(pepeToken, tripId, pepeId, List.of(pepeId, manoloId), 60.0, "Cena");
        createExpense(manoloToken, tripId, manoloId, List.of(pepeId, manoloId), 40.0, "Hotel");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/balances", tripId)
                        .header("Authorization", "Bearer " + pepeToken))
                .andExpect(status().isOk())
                .andReturn();

        BalancesInfo balances = objectMapper.readValue(
                result.getResponse().getContentAsString(), BalancesInfo.class);

        assertEquals(1, balances.getSettlements().size());
        assertNotNull(balances.getSettlements().getFirst().getAmount());
        assertEquals(10.0, balances.getSettlements().getFirst().getAmount(), 0.01);

        mockMvc.perform(delete("/trips/{tripId}/expenses/{expenseId}", tripId, expense1Id)
                        .header("Authorization", "Bearer " + pepeToken))
                .andExpect(status().isNoContent());

        MvcResult result2 = mockMvc.perform(get("/trips/{tripId}/balances", tripId)
                        .header("Authorization", "Bearer " + pepeToken))
                .andExpect(status().isOk())
                .andReturn();

        BalancesInfo balances2 = objectMapper.readValue(
                result2.getResponse().getContentAsString(), BalancesInfo.class);

        assertEquals(1, balances2.getSettlements().size());
        var firstSettlement2 = balances2.getSettlements().getFirst();
        assertNotNull(firstSettlement2.getAmount());
        assertEquals(20.0, firstSettlement2.getAmount(), 0.01);
        assertEquals(manoloId, firstSettlement2.getToId());
        assertEquals(pepeId, firstSettlement2.getFromId());
    }
}
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

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class EventE2ETest extends BaseE2ETest{

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

    @BeforeEach
    @SuppressWarnings("SqlNoDataSourceInspection")
    @AfterAll
    void cleanDb() {
        tx.execute(_ -> {
            em.createNativeQuery("DELETE FROM expense_beneficiaries").executeUpdate();
            em.createNativeQuery("DELETE FROM expenses").executeUpdate();
            em.createNativeQuery("DELETE FROM events").executeUpdate();
            em.createNativeQuery("DELETE FROM documents").executeUpdate();
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

    private UUID createTrip(String token, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/trips")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateTripRequest().name(name))))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), IdResponse.class).getId();
    }

    private UUID createEvent(String token, UUID tripId, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/trips/{tripId}/events", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateEventRequest().name(name))))
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

        UUID requestId = objectMapper.readValue(result.getResponse().getContentAsString(), TripDetail.class)
                .getPendingRequests().getFirst().getId();

        mockMvc.perform(delete("/trips/{tripId}/join-requests/{requestId}", tripId, requestId)
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResolveJoinRequest().accepted(true))))
                .andExpect(status().isNoContent());
    }

    // POST /trips/{tripId}/events

    @Test
    @DisplayName("Create event: member can create an event")
    void createEvent_asMember_returns201WithId() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Roma");

        MvcResult result = mockMvc.perform(post("/trips/{tripId}/events", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateEventRequest().name("Cena"))))
                .andExpect(status().isCreated())
                .andReturn();

        IdResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), IdResponse.class);
        assertNotNull(response.getId());
    }

    @Test
    @DisplayName("Create event: non-member returns 403")
    void createEvent_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("pepe", "pepe@example.com");
        String outsiderToken = registerAndObtainToken("manolo", "manolo@hotmail.com");
        UUID tripId = createTrip(ownerToken, "Viaje a París");

        mockMvc.perform(post("/trips/{tripId}/events", tripId)
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateEventRequest().name("Cena"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Create event: unauthenticated returns 401")
    void createEvent_noToken_returns401() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Berlín");

        mockMvc.perform(post("/trips/{tripId}/events", tripId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateEventRequest().name("Cena"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Create event: empty body returns 400")
    void createEvent_emptyBody_returns400() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Amsterdam");

        mockMvc.perform(post("/trips/{tripId}/events", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateEventRequest())))
                .andExpect(status().isBadRequest());
    }

    // GET /trips/{tripId}/events

    @Test
    @DisplayName("List events: member gets list of events")
    void listEvents_asMember_returns200WithList() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Budapest");

        createEvent(token, tripId, "Cena");
        createEvent(token, tripId, "Visita al museo");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/events", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        EventSummary[] events = objectMapper.readValue(
                result.getResponse().getContentAsString(), EventSummary[].class);

        assertEquals(2, events.length);
    }

    @Test
    @DisplayName("List events: no events returns empty list")
    void listEvents_noEvents_returnsEmptyList() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Cracovia");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/events", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        EventSummary[] events = objectMapper.readValue(
                result.getResponse().getContentAsString(), EventSummary[].class);

        assertEquals(0, events.length);
    }

    @Test
    @DisplayName("List events: non-member returns 403")
    void listEvents_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("pepe", "pepe@example.com");
        String outsiderToken = registerAndObtainToken("manolo", "manolo@hotmail.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Varsovia");

        mockMvc.perform(get("/trips/{tripId}/events", tripId)
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("List events: unauthenticated returns 401")
    void listEvents_noToken_returns401() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Tallin");

        mockMvc.perform(get("/trips/{tripId}/events", tripId))
                .andExpect(status().isUnauthorized());
    }

    // DELETE /trips/{tripId}/events/{eventId}

    @Test
    @DisplayName("Delete event: member can delete an event")
    void deleteEvent_asMember_returns204() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Sofía");
        UUID eventId = createEvent(token, tripId, "Cena");

        mockMvc.perform(delete("/trips/{tripId}/events/{eventId}", tripId, eventId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Delete event: after deletion event is no longer listed")
    void deleteEvent_eventDisappearsFromList() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Atenas");
        UUID eventId = createEvent(token, tripId, "Cena");

        mockMvc.perform(delete("/trips/{tripId}/events/{eventId}", tripId, eventId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/events", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        EventSummary[] events = objectMapper.readValue(
                result.getResponse().getContentAsString(), EventSummary[].class);

        assertEquals(0, events.length);
    }

    @Test
    @DisplayName("Delete event: non-member returns 403")
    void deleteEvent_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("pepe", "pepe@example.com");
        String outsiderToken = registerAndObtainToken("manolo", "manolo@hotmail.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Dubrovnik");
        UUID eventId = createEvent(ownerToken, tripId, "Cena");

        mockMvc.perform(delete("/trips/{tripId}/events/{eventId}", tripId, eventId)
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Delete event: unauthenticated returns 401")
    void deleteEvent_noToken_returns401() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId = createTrip(token, "Viaje a Kotor");
        UUID eventId = createEvent(token, tripId, "Cena");

        mockMvc.perform(delete("/trips/{tripId}/events/{eventId}", tripId, eventId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Delete event: event from another trip returns 403")
    void deleteEvent_eventFromAnotherTrip_returns403() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        UUID tripId1 = createTrip(token, "Viaje a Lisboa");
        UUID tripId2 = createTrip(token, "Viaje a Oporto");
        UUID eventId = createEvent(token, tripId1, "Cena");

        mockMvc.perform(delete("/trips/{tripId}/events/{eventId}", tripId2, eventId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    // Complete flow

    @Test
    @DisplayName("Complete flow: create events -> list -> another member deletes -> verify removed")
    void completeFlow_createAndDelete() throws Exception {
        String pepeToken = registerAndObtainToken("pepe", "pepe@example.com");
        String manoloToken = registerAndObtainToken("manolo", "manolo@hotmail.com");
        UUID tripId = createTrip(pepeToken, "Viaje a Nápoles");

        joinTrip(manoloToken, pepeToken, tripId);

        UUID event1Id = createEvent(pepeToken, tripId, "Cena en trattoria");
        createEvent(manoloToken, tripId, "Visita al Coliseo");

        MvcResult listResult = mockMvc.perform(get("/trips/{tripId}/events", tripId)
                        .header("Authorization", "Bearer " + pepeToken))
                .andExpect(status().isOk())
                .andReturn();

        EventSummary[] events = objectMapper.readValue(
                listResult.getResponse().getContentAsString(), EventSummary[].class);

        assertEquals(2, events.length);

        mockMvc.perform(delete("/trips/{tripId}/events/{eventId}", tripId, event1Id)
                        .header("Authorization", "Bearer " + manoloToken))
                .andExpect(status().isNoContent());

        MvcResult afterDelete = mockMvc.perform(get("/trips/{tripId}/events", tripId)
                        .header("Authorization", "Bearer " + pepeToken))
                .andExpect(status().isOk())
                .andReturn();

        EventSummary[] remaining = objectMapper.readValue(
                afterDelete.getResponse().getContentAsString(), EventSummary[].class);

        assertEquals(1, remaining.length);
        assertEquals("Visita al Coliseo", remaining[0].getName());
    }
}

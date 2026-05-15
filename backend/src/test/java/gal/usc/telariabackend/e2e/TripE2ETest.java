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

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@TestMethodOrder(MethodOrderer.DisplayName.class)
class TripE2ETest {

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

    private UUID createTripAndObtainId(String token, String tripName) throws Exception {
        CreateTripRequest body = new CreateTripRequest().name(tripName);

        MvcResult result = mockMvc.perform(post("/trips")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readValue(result.getResponse().getContentAsString(), IdResponse.class)
                .getId();
    }

    // POST /trips

    @Test
    @DisplayName("POST /trips: authenticated user creates trip and gets its id")
    void createTrip_authenticatedUser_returns201WithId() throws Exception {
        String token = registerAndObtainToken("pepe", "pepe@example.com");
        CreateTripRequest body = new CreateTripRequest().name("Viaje a Roma");

        MvcResult result = mockMvc.perform(post("/trips")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();

        IdResponse response = objectMapper.readValue(
                result.getResponse().getContentAsString(), IdResponse.class);

        assertNotNull(response.getId());
    }

    @Test
    @DisplayName("POST /trips: without token returns 401")
    void createTrip_withoutToken_returns401() throws Exception {
        CreateTripRequest body = new CreateTripRequest().name("Viaje a Roma");

        mockMvc.perform(post("/trips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /trips: empty body returns 400")
    void createTrip_emptyBody_returns400() throws Exception {
        String token = registerAndObtainToken("lola", "lola@test.com");

        mockMvc.perform(post("/trips")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateTripRequest())))
                .andExpect(status().isBadRequest());
    }

    // GET /trips

    @Test
    @DisplayName("GET /trips: returns only trips where user is member")
    void listTrips_returnsOnlyOwnTrips() throws Exception {
        String pepe = registerAndObtainToken("pepe", "pepe@example.com");
        String manolo = registerAndObtainToken("manolo", "manolo@hotmail.com");

        createTripAndObtainId(pepe, "Viaje de Pepe");
        createTripAndObtainId(manolo, "Viaje de Manolo");

        MvcResult result = mockMvc.perform(get("/trips")
                        .header("Authorization", "Bearer " + pepe))
                .andExpect(status().isOk())
                .andReturn();

        List<TripSummary> trips = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, TripSummary.class));

        assertEquals(1, trips.size());
        assertEquals("Viaje de Pepe", trips.getFirst().getName());
    }

    @Test
    @DisplayName("GET /trips: user with no trips returns empty list")
    void listTrips_noTrips_returnsEmptyList() throws Exception {
        String token = registerAndObtainToken("fran", "fran@gmail.com");

        MvcResult result = mockMvc.perform(get("/trips")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        List<TripSummary> trips = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, TripSummary.class));

        assertTrue(trips.isEmpty());
    }

    @Test
    @DisplayName("GET /trips: without token returns 401")
    void listTrips_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/trips"))
                .andExpect(status().isUnauthorized());
    }

    // GET /trips/{id}

    @Test
    @DisplayName("GET /trips/{tripId}: owner gets trip details")
    void getTrip_owner_returns200WithDetails() throws Exception {
        String token = registerAndObtainToken("mari", "mari@yahoo.es");
        UUID tripId = createTripAndObtainId(token, "Viaje a París");

        MvcResult result = mockMvc.perform(get("/trips/" + tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        TripDetail detail = objectMapper.readValue(result.getResponse().getContentAsString(), TripDetail.class);

        assertEquals(tripId, detail.getId());
        assertEquals("Viaje a París", detail.getName());
    }

    @Test
    @DisplayName("GET /trips/{tripId}: non-member gets 403")
    void getTrip_nonMember_returns403() throws Exception {
        String pepe = registerAndObtainToken("pepe", "pepe@example.com");
        String manolo = registerAndObtainToken("manolo", "manolo@hotmail.com");
        UUID tripId = createTripAndObtainId(pepe, "Viaje secreto de Pepe");

        mockMvc.perform(get("/trips/" + tripId)
                        .header("Authorization", "Bearer " + manolo))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /trips/{tripId}: non-existent trip returns 403")
    void getTrip_nonExistentTrip_returns403() throws Exception {
        String token = registerAndObtainToken("curro", "curro@outlook.com");

        mockMvc.perform(get("/trips/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /trips/{tripId}: without token returns 401")
    void getTrip_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/trips/" + UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    // Complete flow

    @Test
    @DisplayName("Complete flow: create trip -> list -> get details")
    void flujoCompleto_trips() throws Exception {
        String token = registerAndObtainToken("paqui", "paqui@example.com");
        UUID tripId = createTripAndObtainId(token, "Viaje a Tokyo");

        MvcResult listResult = mockMvc.perform(get("/trips")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        List<TripSummary> trips = objectMapper.readValue(
                listResult.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, TripSummary.class));

        assertTrue(trips.stream().anyMatch(t -> tripId.equals(t.getId())));
        assertTrue(trips.stream().anyMatch(t -> "Viaje a Tokyo".equals(t.getName())));

        MvcResult detailResult = mockMvc.perform(get("/trips/" + tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        TripDetail detail = objectMapper.readValue(detailResult.getResponse().getContentAsString(), TripDetail.class);

        assertEquals(tripId, detail.getId());
        assertEquals("Viaje a Tokyo", detail.getName());
    }
}
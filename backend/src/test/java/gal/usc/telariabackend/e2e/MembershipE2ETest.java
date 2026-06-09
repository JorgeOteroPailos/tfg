package gal.usc.telariabackend.e2e;

import com.fasterxml.jackson.databind.ObjectMapper;
import gal.usc.telariabackend.model.dto.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MembershipE2ETest extends BaseE2ETest{

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

    private UUID createJoinRequest(String token, String ownerToken, UUID tripId) throws Exception {
        mockMvc.perform(post("/trips/{tripId}/join-requests", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        MvcResult result = mockMvc.perform(get("/trips/{tripId}", tripId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andReturn();

        TripDetail detail = objectMapper.readValue(result.getResponse().getContentAsString(), TripDetail.class);
        assertFalse(detail.getPendingRequests().isEmpty(), "Expected at least one pending join request");
        return detail.getPendingRequests().getFirst().getId();
    }

    private void resolveJoinRequest(String token, UUID tripId, UUID requestId) throws Exception {
        ResolveJoinRequest body = new ResolveJoinRequest().accepted(true);

        mockMvc.perform(delete("/trips/{tripId}/join-requests/{requestId}", tripId, requestId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    private void invite(String inviterToken, UUID guestUserId, UUID tripId) throws Exception {
        CreateInvitationRequest body = new CreateInvitationRequest().tripId(tripId);

        mockMvc.perform(post("/users/{userId}/invitations", guestUserId)
                        .header("Authorization", "Bearer " + inviterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isNoContent());
    }

    private UUID getMyFirstInvitationId(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/users/me/invitations")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        InvitationSummary[] invitations = objectMapper.readValue(
                result.getResponse().getContentAsString(), InvitationSummary[].class);

        assertTrue(invitations.length > 0, "Expected at least one pending invitation");
        return invitations[0].getId();
    }

    private void resolveInvitation(String token, UUID invitationId) throws Exception {
        ResolveJoinRequest body = new ResolveJoinRequest().accepted(true);

        mockMvc.perform(delete("/users/me/invitations/{invitationId}", invitationId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    // -------------------------------------------------------------------------
    // POST /trips/{tripId}/join-requests
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Join request: authenticated user can request to join an existing trip")
    void createJoinRequest_validTrip_returns204() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.jrv@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.jrv@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Roma");

        mockMvc.perform(post("/trips/{tripId}/join-requests", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Join request: unauthenticated request returns 401")
    void createJoinRequest_noToken_returns401() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.jrnt@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a París");

        mockMvc.perform(post("/trips/{tripId}/join-requests", tripId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Join request: non-existent trip returns 403 (trip existence not revealed)")
    void createJoinRequest_nonExistentTrip_returns403() throws Exception {
        String guestToken = registerAndObtainToken("guest", "guest.jrnx@test.com");

        mockMvc.perform(post("/trips/{tripId}/join-requests", UUID.randomUUID())
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Join request: duplicate request returns 409")
    void createJoinRequest_alreadyPending_returns409() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.jrap@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.jrap@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Berlín");

        mockMvc.perform(post("/trips/{tripId}/join-requests", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/trips/{tripId}/join-requests", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Join request: already a member returns 409")
    void createJoinRequest_alreadyMember_returns409() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.jram@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.jram@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Lisboa");

        UUID requestId = createJoinRequest(guestToken, ownerToken, tripId);
        resolveJoinRequest(ownerToken, tripId, requestId);

        mockMvc.perform(post("/trips/{tripId}/join-requests", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isConflict());
    }

    // -------------------------------------------------------------------------
    // DELETE /trips/{tripId}/join-requests/{requestId}
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Resolve join request: member can accept a pending request")
    void resolveJoinRequest_accept_returns200() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.rjra@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.rjra@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Amsterdam");
        UUID requestId = createJoinRequest(guestToken, ownerToken, tripId);

        ResolveJoinRequest body = new ResolveJoinRequest().accepted(true);

        mockMvc.perform(delete("/trips/{tripId}/join-requests/{requestId}", tripId, requestId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Resolve join request: member can reject a pending request")
    void resolveJoinRequest_reject_returns200() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.rjrr@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.rjrr@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Praga");
        UUID requestId = createJoinRequest(guestToken, ownerToken, tripId);

        ResolveJoinRequest body = new ResolveJoinRequest().accepted(false);

        mockMvc.perform(delete("/trips/{tripId}/join-requests/{requestId}", tripId, requestId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Resolve join request: non-member cannot resolve a request")
    void resolveJoinRequest_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.rjrx@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.rjrx@test.com");
        String outsiderToken = registerAndObtainToken("outsider", "outsider.rjrx@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Viena");
        UUID requestId = createJoinRequest(guestToken, ownerToken, tripId);

        ResolveJoinRequest body = new ResolveJoinRequest().accepted(true);

        mockMvc.perform(delete("/trips/{tripId}/join-requests/{requestId}", tripId, requestId)
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Resolve join request: unauthenticated returns 401")
    void resolveJoinRequest_noToken_returns401() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.rjrnt@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.rjrnt@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Bruselas");
        UUID requestId = createJoinRequest(guestToken, ownerToken, tripId);

        ResolveJoinRequest body = new ResolveJoinRequest().accepted(true);

        mockMvc.perform(delete("/trips/{tripId}/join-requests/{requestId}", tripId, requestId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Resolve join request: any member (not just creator) can accept")
    void resolveJoinRequest_secondMemberCanAccept_returns200() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.rjr2@test.com");
        String member2Token = registerAndObtainToken("member2", "member2.rjr2@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.rjr2@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Copenhague");

        UUID member2RequestId = createJoinRequest(member2Token, ownerToken, tripId);
        resolveJoinRequest(ownerToken, tripId, member2RequestId);

        UUID guestRequestId = createJoinRequest(guestToken, member2Token, tripId);

        ResolveJoinRequest body = new ResolveJoinRequest().accepted(true);
        mockMvc.perform(delete("/trips/{tripId}/join-requests/{requestId}", tripId, guestRequestId)
                        .header("Authorization", "Bearer " + member2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    // -------------------------------------------------------------------------
    // POST /users/{userId}/invitations
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Invite: member can invite another user to a trip")
    void createInvitation_validRequest_returns204() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.inv@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.inv@test.com");
        UUID guestId = extractUserIdFromToken(guestToken);
        UUID tripId = createTrip(ownerToken, "Viaje a Estocolmo");

        invite(ownerToken, guestId, tripId);
    }

    @Test
    @DisplayName("Invite: non-member cannot invite to a trip")
    void createInvitation_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.invx@test.com");
        String outsiderToken = registerAndObtainToken("outsider", "outsider.invx@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.invx@test.com");
        UUID guestId = extractUserIdFromToken(guestToken);
        UUID tripId = createTrip(ownerToken, "Viaje a Helsinki");

        CreateInvitationRequest body = new CreateInvitationRequest().tripId(tripId);

        mockMvc.perform(post("/users/{userId}/invitations", guestId)
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Invite: unauthenticated returns 401")
    void createInvitation_noToken_returns401() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.invnt@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.invnt@test.com");
        UUID guestId = extractUserIdFromToken(guestToken);
        UUID tripId = createTrip(ownerToken, "Viaje a Oslo");

        CreateInvitationRequest body = new CreateInvitationRequest().tripId(tripId);

        mockMvc.perform(post("/users/{userId}/invitations", guestId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Invite: duplicate invitation returns 409")
    void createInvitation_alreadyPending_returns409() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.invap@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.invap@test.com");
        UUID guestId = extractUserIdFromToken(guestToken);
        UUID tripId = createTrip(ownerToken, "Viaje a Reikiavik");

        invite(ownerToken, guestId, tripId);

        CreateInvitationRequest body = new CreateInvitationRequest().tripId(tripId);
        mockMvc.perform(post("/users/{userId}/invitations", guestId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Invite: inviting an already-member user returns 409")
    void createInvitation_alreadyMember_returns409() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.invam@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.invam@test.com");
        UUID guestId = extractUserIdFromToken(guestToken);
        UUID tripId = createTrip(ownerToken, "Viaje a Tallin");

        UUID requestId = createJoinRequest(guestToken, ownerToken, tripId);
        resolveJoinRequest(ownerToken, tripId, requestId);

        CreateInvitationRequest body = new CreateInvitationRequest().tripId(tripId);
        mockMvc.perform(post("/users/{userId}/invitations", guestId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isConflict());
    }

    // -------------------------------------------------------------------------
    // GET /users/me/invitations
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Get invitations: returns list of pending invitations")
    void getMyInvitations_withPendingInvitation_returnsList() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.invl@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.invl@test.com");
        UUID guestId = extractUserIdFromToken(guestToken);
        UUID tripId = createTrip(ownerToken, "Viaje a Varsovia");

        invite(ownerToken, guestId, tripId);

        MvcResult result = mockMvc.perform(get("/users/me/invitations")
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isOk())
                .andReturn();

        InvitationSummary[] invitations = objectMapper.readValue(
                result.getResponse().getContentAsString(), InvitationSummary[].class);

        assertEquals(1, invitations.length);
        assertEquals(tripId, invitations[0].getTripId());
    }

    @Test
    @DisplayName("Get invitations: returns empty list when no invitations pending")
    void getMyInvitations_noPendingInvitations_returnsEmptyList() throws Exception {
        String guestToken = registerAndObtainToken("guest", "guest.inve@test.com");

        MvcResult result = mockMvc.perform(get("/users/me/invitations")
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isOk())
                .andReturn();

        InvitationSummary[] invitations = objectMapper.readValue(
                result.getResponse().getContentAsString(), InvitationSummary[].class);

        assertEquals(0, invitations.length);
    }

    @Test
    @DisplayName("Get invitations: unauthenticated returns 401")
    void getMyInvitations_noToken_returns401() throws Exception {
        mockMvc.perform(get("/users/me/invitations"))
                .andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------------------------------
    // DELETE /users/me/invitations/{invitationId}
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Resolve invitation: user can accept their invitation")
    void resolveInvitation_accept_returns200() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.ria@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.ria@test.com");
        UUID guestId = extractUserIdFromToken(guestToken);
        UUID tripId = createTrip(ownerToken, "Viaje a Budapest");

        invite(ownerToken, guestId, tripId);
        UUID invitationId = getMyFirstInvitationId(guestToken);

        ResolveJoinRequest body = new ResolveJoinRequest().accepted(true);
        mockMvc.perform(delete("/users/me/invitations/{invitationId}", invitationId)
                        .header("Authorization", "Bearer " + guestToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Resolve invitation: user can reject their invitation")
    void resolveInvitation_reject_returns200() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.rir@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.rir@test.com");
        UUID guestId = extractUserIdFromToken(guestToken);
        UUID tripId = createTrip(ownerToken, "Viaje a Cracovia");

        invite(ownerToken, guestId, tripId);
        UUID invitationId = getMyFirstInvitationId(guestToken);

        ResolveJoinRequest body = new ResolveJoinRequest().accepted(false);
        mockMvc.perform(delete("/users/me/invitations/{invitationId}", invitationId)
                        .header("Authorization", "Bearer " + guestToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Resolve invitation: cannot resolve another user's invitation")
    void resolveInvitation_notYourInvitation_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.rix@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.rix@test.com");
        String otherToken = registerAndObtainToken("other", "other.rix@test.com");
        UUID guestId = extractUserIdFromToken(guestToken);
        UUID tripId = createTrip(ownerToken, "Viaje a Bratislava");

        invite(ownerToken, guestId, tripId);
        UUID invitationId = getMyFirstInvitationId(guestToken);

        ResolveJoinRequest body = new ResolveJoinRequest().accepted(true);
        mockMvc.perform(delete("/users/me/invitations/{invitationId}", invitationId)
                        .header("Authorization", "Bearer " + otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Resolve invitation: unauthenticated returns 401")
    void resolveInvitation_noToken_returns401() throws Exception {
        ResolveJoinRequest body = new ResolveJoinRequest().accepted(true);

        mockMvc.perform(delete("/users/me/invitations/{invitationId}", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Resolve invitation: accepting adds the user to the trip")
    void resolveInvitation_accept_userIsNowMember() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.rim@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.rim@test.com");
        UUID guestId = extractUserIdFromToken(guestToken);
        UUID tripId = createTrip(ownerToken, "Viaje a Sofía");

        invite(ownerToken, guestId, tripId);
        UUID invitationId = getMyFirstInvitationId(guestToken);
        resolveInvitation(guestToken, invitationId);

        mockMvc.perform(get("/trips/{tripId}", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isOk());
    }

    // -------------------------------------------------------------------------
    // DELETE /trips/{tripId}/members/me
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Leave trip: member can leave a trip")
    void leaveTrip_asMember_returns200() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.lv@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.lv@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Atenas");

        UUID requestId = createJoinRequest(guestToken, ownerToken, tripId);
        resolveJoinRequest(ownerToken, tripId, requestId);

        mockMvc.perform(delete("/trips/{tripId}/members/me", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Leave trip: non-member returns 403")
    void leaveTrip_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.lvx@test.com");
        String outsiderToken = registerAndObtainToken("outsider", "outsider.lvx@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Dubrovnik");

        mockMvc.perform(delete("/trips/{tripId}/members/me", tripId)
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Leave trip: unauthenticated returns 401")
    void leaveTrip_noToken_returns401() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.lvnt@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Kotor");

        mockMvc.perform(delete("/trips/{tripId}/members/me", tripId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Leave trip: after leaving, user can no longer access the trip")
    void leaveTrip_afterLeaving_tripIsInaccessible() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.lva@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.lva@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Sarajevo");

        UUID requestId = createJoinRequest(guestToken, ownerToken, tripId);
        resolveJoinRequest(ownerToken, tripId, requestId);

        mockMvc.perform(delete("/trips/{tripId}/members/me", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/trips/{tripId}", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Leave trip: last member leaving deletes the trip entirely")
    void leaveTrip_lastMember_tripIsDeletedFromDatabase() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.lvlast@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje solitario");

        mockMvc.perform(delete("/trips/{tripId}/members/me", tripId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        MvcResult listResult = mockMvc.perform(get("/trips")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andReturn();

        String json = listResult.getResponse().getContentAsString();
        assertFalse(json.contains(tripId.toString()),
                "Deleted trip should no longer appear in the owner's trip list");
    }

    @Test
    @DisplayName("Leave trip: last member leaving with pending requests and invitations succeeds (cascade)")
    void leaveTrip_lastMemberWithDependentData_succeeds() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.lvdep@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.lvdep@test.com");
        String inviteeToken = registerAndObtainToken("invitee", "invitee.lvdep@test.com");
        UUID guestId = extractUserIdFromToken(guestToken);
        UUID inviteeId = extractUserIdFromToken(inviteeToken);
        UUID tripId = createTrip(ownerToken, "Viaje con dependencias");

        // create a pending join request
        mockMvc.perform(post("/trips/{tripId}/join-requests", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isNoContent());

        // create a pending invitation
        invite(ownerToken, inviteeId, tripId);

        // owner (last member) leaves — should cascade-delete join request, invitation, and the trip
        mockMvc.perform(delete("/trips/{tripId}/members/me", tripId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        MvcResult listResult = mockMvc.perform(get("/trips")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andReturn();

        assertFalse(listResult.getResponse().getContentAsString().contains(tripId.toString()));

        // invitee should now have no pending invitations for this trip
        MvcResult invResult = mockMvc.perform(get("/users/me/invitations")
                        .header("Authorization", "Bearer " + inviteeToken))
                .andExpect(status().isOk())
                .andReturn();

        assertFalse(invResult.getResponse().getContentAsString().contains(tripId.toString()));
    }

    // -------------------------------------------------------------------------
    // Complete flows
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Complete flow: join request -> accept -> leave")
    void completeFlow_joinRequestAcceptLeave() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.cjr@test.com");
        String guestToken = registerAndObtainToken("guest", "guest.cjr@test.com");
        UUID tripId = createTrip(ownerToken, "Viaje a Oporto");

        mockMvc.perform(get("/trips/{tripId}", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isForbidden());

        UUID requestId = createJoinRequest(guestToken, ownerToken, tripId);
        resolveJoinRequest(ownerToken, tripId, requestId);

        mockMvc.perform(get("/trips/{tripId}", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/trips/{tripId}/members/me", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/trips/{tripId}", tripId)
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Complete flow: invite -> accept -> new member can resolve other requests")
    void completeFlow_inviteAcceptAndResolveRequest() throws Exception {
        String ownerToken = registerAndObtainToken("owner", "owner.ci@test.com");
        String invitedToken = registerAndObtainToken("invited", "invited.ci@test.com");
        String requesterToken = registerAndObtainToken("requester", "requester.ci@test.com");
        UUID invitedId = extractUserIdFromToken(invitedToken);
        UUID tripId = createTrip(ownerToken, "Viaje a Nápoles");

        invite(ownerToken, invitedId, tripId);
        UUID invitationId = getMyFirstInvitationId(invitedToken);
        resolveInvitation(invitedToken, invitationId);

        UUID requestId = createJoinRequest(requesterToken, invitedToken, tripId);
        resolveJoinRequest(invitedToken, tripId, requestId);

        mockMvc.perform(get("/trips/{tripId}", tripId)
                        .header("Authorization", "Bearer " + requesterToken))
                .andExpect(status().isOk());
    }
}
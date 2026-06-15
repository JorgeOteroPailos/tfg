package gal.usc.telariabackend.e2e;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import gal.usc.telariabackend.model.dto.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.net.URI;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SharedDocumentE2ETest extends BaseE2ETest {

    MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Autowired
    private WebApplicationContext context;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    @Autowired
    private TransactionTemplate tx;
    @Autowired
    private EntityManager em;

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

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private String registerAndObtainToken(String username) throws Exception {
        RegisterRequest body = new RegisterRequest()
                .username(username)
                .email(UUID.randomUUID() + "@example.com")
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

    private DocumentUploadResponse initUpload(String token, UUID tripId, String fileName) throws Exception {
        return initUpload(token, tripId, fileName, "application/pdf");
    }

    private DocumentUploadResponse initUpload(String token, UUID tripId, String fileName, String contentType) throws Exception {
        DocumentUploadRequest body = new DocumentUploadRequest()
                .name(fileName)
                .contentType(contentType);

        MvcResult result = mockMvc.perform(post("/trips/{tripId}/documents", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), DocumentUploadResponse.class);
    }

    private void confirmUpload(String token, UUID tripId, UUID documentId) throws Exception {
        mockMvc.perform(post("/trips/{tripId}/documents/{documentId}/confirm", tripId, documentId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    private void uploadFileToMinio(String uploadUrl) throws Exception {
        uploadBytesToMinio(uploadUrl, "%PDF-1.4 1 0 obj<</Type/Catalog>>endobj".getBytes());
    }

    private void uploadBytesToMinio(String uploadUrl, byte[] bytes) throws Exception {
        try (java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient()) {
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(URI.create(uploadUrl))
                    .PUT(java.net.http.HttpRequest.BodyPublishers.ofByteArray(bytes))
                    .build();

            java.net.http.HttpResponse<String> response = client.send(request,
                    java.net.http.HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 400) {
                throw new RuntimeException("Minio upload failed: " + response.statusCode() + "\nBody: " + response.body());
            }
        }
    }

    private static byte[] pngBytes(int width, int height) throws Exception {
        java.awt.image.BufferedImage image =
                new java.awt.image.BufferedImage(width, height, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.awt.Graphics2D g = image.createGraphics();
        g.setColor(java.awt.Color.ORANGE);
        g.fillRect(0, 0, width, height);
        g.dispose();
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private byte[] httpGetBytes(String url) throws Exception {
        try (java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient()) {
            java.net.http.HttpResponse<byte[]> response = client.send(
                    java.net.http.HttpRequest.newBuilder().uri(URI.create(url)).GET().build(),
                    java.net.http.HttpResponse.BodyHandlers.ofByteArray());
            assertEquals(200, response.statusCode());
            return response.body();
        }
    }

    private UUID uploadDocumentCompletely(String token, UUID tripId, String fileName) throws Exception {
        DocumentUploadResponse uploadResponse = initUpload(token, tripId, fileName);
        uploadFileToMinio(uploadResponse.getUploadUrl());
        confirmUpload(token, tripId, uploadResponse.getDocumentId());
        return uploadResponse.getDocumentId();
    }

    private void addMemberToTrip(String ownerToken, String memberToken, UUID tripId) throws Exception {
        mockMvc.perform(post("/trips/{tripId}/join-requests", tripId)
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isNoContent());

        MvcResult tripResult = mockMvc.perform(get("/trips/{tripId}", tripId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andReturn();

        TripDetail detail = objectMapper.readValue(tripResult.getResponse().getContentAsString(), TripDetail.class);
        UUID requestId = detail.getPendingRequests().getFirst().getId();

        mockMvc.perform(delete("/trips/{tripId}/join-requests/{requestId}", tripId, requestId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResolveJoinRequest().accepted(true))))
                .andExpect(status().isNoContent());

    }

    // -------------------------------------------------------------------------
    // POST /trips/{tripId}/documents  (init upload)
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Init upload: member gets 201 with documentId and uploadUrl")
    void initUpload_member_returns201() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Roma");

        DocumentUploadRequest body = new DocumentUploadRequest()
                .name("billete.pdf")
                .contentType("application/pdf");

        MvcResult result = mockMvc.perform(post("/trips/{tripId}/documents", tripId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();

        DocumentUploadResponse response = objectMapper.readValue(
                result.getResponse().getContentAsString(), DocumentUploadResponse.class);

        assertNotNull(response.getDocumentId());
        assertNotNull(response.getUploadUrl());
        assertFalse(response.getUploadUrl().isBlank());
    }

    @Test
    @DisplayName("Init upload: non-member gets 403")
    void initUpload_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("owner");
        String outsiderToken = registerAndObtainToken("outsider");
        UUID tripId = createTrip(ownerToken, "Viaje a París");

        DocumentUploadRequest body = new DocumentUploadRequest()
                .name("billete.pdf")
                .contentType("application/pdf");

        mockMvc.perform(post("/trips/{tripId}/documents", tripId)
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Init upload: unauthenticated returns 401")
    void initUpload_noToken_returns401() throws Exception {
        String ownerToken = registerAndObtainToken("owner");
        UUID tripId = createTrip(ownerToken, "Viaje a Berlín");

        DocumentUploadRequest body = new DocumentUploadRequest()
                .name("billete.pdf")
                .contentType("application/pdf");

        mockMvc.perform(post("/trips/{tripId}/documents", tripId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------------------------------
    // POST /trips/{tripId}/documents/{documentId}/confirm
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Confirm upload: after uploading to Minio returns 200")
    void confirmUpload_fileExistsInMinio_returns200() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Lisboa");

        DocumentUploadResponse uploadResponse = initUpload(token, tripId, "vuelo.pdf");
        uploadFileToMinio(uploadResponse.getUploadUrl());

        mockMvc.perform(post("/trips/{tripId}/documents/{documentId}/confirm", tripId, uploadResponse.getDocumentId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Confirm upload: without uploading to Minio returns 409")
    void confirmUpload_fileNotInMinio_returns409() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Amsterdam");

        DocumentUploadResponse uploadResponse = initUpload(token, tripId, "vuelo.pdf");

        mockMvc.perform(post("/trips/{tripId}/documents/{documentId}/confirm", tripId, uploadResponse.getDocumentId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Confirm upload: non-existent document returns 404")
    void confirmUpload_nonExistentDocument_returns404() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Praga");

        mockMvc.perform(post("/trips/{tripId}/documents/{documentId}/confirm", tripId, UUID.randomUUID())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Confirm upload: unauthenticated returns 401")
    void confirmUpload_noToken_returns401() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Viena");
        DocumentUploadResponse uploadResponse = initUpload(token, tripId, "vuelo.pdf");

        mockMvc.perform(post("/trips/{tripId}/documents/{documentId}/confirm", tripId, uploadResponse.getDocumentId()))
                .andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------------------------------
    // GET /trips/{tripId}/documents
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("List documents: member sees uploaded documents")
    void listDocuments_member_returnsUploadedDocuments() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Budapest");

        uploadDocumentCompletely(token, tripId, "billete.pdf");
        uploadDocumentCompletely(token, tripId, "hotel.pdf");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/documents", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        DocumentResponse[] documents = objectMapper.readValue(
                result.getResponse().getContentAsString(), DocumentResponse[].class);

        assertEquals(2, documents.length);
    }

    @Test
    @DisplayName("List documents: uploader sees their own PENDING document")
    void listDocuments_uploaderSeesPending() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Cracovia");

        initUpload(token, tripId, "pendiente.pdf");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/documents", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        DocumentResponse[] documents = objectMapper.readValue(
                result.getResponse().getContentAsString(), DocumentResponse[].class);

        assertEquals(1, documents.length);
    }

    @Test
    @DisplayName("List documents: other member does not see PENDING documents")
    void listDocuments_otherMemberDoesNotSeePending() throws Exception {
        String ownerToken = registerAndObtainToken("owner");
        String uploaderToken = registerAndObtainToken("uploader");
        UUID tripId = createTrip(ownerToken, "Viaje a Varsovia");

        addMemberToTrip(ownerToken, uploaderToken, tripId);
        initUpload(uploaderToken, tripId, "pendiente.pdf");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/documents", tripId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andReturn();

        DocumentResponse[] documents = objectMapper.readValue(
                result.getResponse().getContentAsString(), DocumentResponse[].class);

        assertEquals(0, documents.length);
    }

    @Test
    @DisplayName("List documents: non-member gets 403")
    void listDocuments_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("owner");
        String outsiderToken = registerAndObtainToken("outsider");
        UUID tripId = createTrip(ownerToken, "Viaje a Sofía");

        mockMvc.perform(get("/trips/{tripId}/documents", tripId)
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("List documents: unauthenticated returns 401")
    void listDocuments_noToken_returns401() throws Exception {
        String ownerToken = registerAndObtainToken("owner");
        UUID tripId = createTrip(ownerToken, "Viaje a Atenas");

        mockMvc.perform(get("/trips/{tripId}/documents", tripId))
                .andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------------------------------
    // GET /trips/{tripId}/documents/{documentId}  (download URL)
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Get download URL: member gets presigned URL")
    void getDownloadUrl_member_returnsUrl() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Dubrovnik");
        UUID documentId = uploadDocumentCompletely(token, tripId, "billete.pdf");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/documents/{documentId}", tripId, documentId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        DocumentDownloadResponse response = objectMapper.readValue(
                result.getResponse().getContentAsString(), DocumentDownloadResponse.class);

        assertNotNull(response.getDownloadUrl());
        assertFalse(response.getDownloadUrl().isBlank());
    }

    @Test
    @DisplayName("Get download URL: non-existent document returns 404")
    void getDownloadUrl_nonExistentDocument_returns404() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Sarajevo");

        mockMvc.perform(get("/trips/{tripId}/documents/{documentId}", tripId, UUID.randomUUID())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Get download URL: non-member gets 403")
    void getDownloadUrl_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("owner");
        String outsiderToken = registerAndObtainToken("outsider");
        UUID tripId = createTrip(ownerToken, "Viaje a Kotor");
        UUID documentId = uploadDocumentCompletely(ownerToken, tripId, "billete.pdf");

        mockMvc.perform(get("/trips/{tripId}/documents/{documentId}", tripId, documentId)
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Get download URL: unauthenticated returns 401")
    void getDownloadUrl_noToken_returns401() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Nápoles");
        UUID documentId = uploadDocumentCompletely(token, tripId, "billete.pdf");

        mockMvc.perform(get("/trips/{tripId}/documents/{documentId}", tripId, documentId))
                .andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------------------------------
    // DELETE /trips/{tripId}/documents/{documentId}
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Delete document: uploader can delete their own document")
    void deleteDocument_uploader_returns204() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Oporto");
        UUID documentId = uploadDocumentCompletely(token, tripId, "billete.pdf");

        mockMvc.perform(delete("/trips/{tripId}/documents/{documentId}", tripId, documentId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Delete document: other member cannot delete someone else's document")
    void deleteDocument_otherMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("owner");
        String memberToken = registerAndObtainToken("member");
        UUID tripId = createTrip(ownerToken, "Viaje a Estocolmo");

        addMemberToTrip(ownerToken, memberToken, tripId);
        UUID documentId = uploadDocumentCompletely(ownerToken, tripId, "billete.pdf");

        mockMvc.perform(delete("/trips/{tripId}/documents/{documentId}", tripId, documentId)
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Delete document: non-existent document returns 404")
    void deleteDocument_nonExistentDocument_returns404() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Helsinki");

        mockMvc.perform(delete("/trips/{tripId}/documents/{documentId}", tripId, UUID.randomUUID())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Delete document: non-member gets 403")
    void deleteDocument_nonMember_returns403() throws Exception {
        String ownerToken = registerAndObtainToken("owner");
        String outsiderToken = registerAndObtainToken("outsider");
        UUID tripId = createTrip(ownerToken, "Viaje a Oslo");
        UUID documentId = uploadDocumentCompletely(ownerToken, tripId, "billete.pdf");

        mockMvc.perform(delete("/trips/{tripId}/documents/{documentId}", tripId, documentId)
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Delete document: unauthenticated returns 401")
    void deleteDocument_noToken_returns401() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Tallin");
        UUID documentId = uploadDocumentCompletely(token, tripId, "billete.pdf");

        mockMvc.perform(delete("/trips/{tripId}/documents/{documentId}", tripId, documentId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Delete document: after deleting, document no longer appears in list")
    void deleteDocument_afterDelete_notInList() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Bratislava");
        UUID documentId = uploadDocumentCompletely(token, tripId, "billete.pdf");

        mockMvc.perform(delete("/trips/{tripId}/documents/{documentId}", tripId, documentId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/documents", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        DocumentResponse[] documents = objectMapper.readValue(
                result.getResponse().getContentAsString(), DocumentResponse[].class);

        assertEquals(0, documents.length);
    }

    // -------------------------------------------------------------------------
    // Image previews (thumbnails)
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Preview: image document gets a downscaled previewUrl in the list")
    void preview_imageDocument_listIncludesPreviewUrl() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Roma con fotos");

        DocumentUploadResponse uploadResponse = initUpload(token, tripId, "foto.png", "image/png");
        uploadBytesToMinio(uploadResponse.getUploadUrl(), pngBytes(1200, 800));
        confirmUpload(token, tripId, uploadResponse.getDocumentId());

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/documents", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        DocumentResponse[] documents = objectMapper.readValue(
                result.getResponse().getContentAsString(), DocumentResponse[].class);

        assertEquals(1, documents.length);
        assertNotNull(documents[0].getPreviewUrl());

        byte[] thumbBytes = httpGetBytes(documents[0].getPreviewUrl());
        java.awt.image.BufferedImage thumb = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(thumbBytes));
        assertNotNull(thumb);
        assertEquals(512, thumb.getWidth());
        assertTrue(thumb.getHeight() <= 512);
    }

    @Test
    @DisplayName("Preview: non-image document has no previewUrl")
    void preview_pdfDocument_hasNoPreviewUrl() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Milán");

        uploadDocumentCompletely(token, tripId, "billete.pdf");

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/documents", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        DocumentResponse[] documents = objectMapper.readValue(
                result.getResponse().getContentAsString(), DocumentResponse[].class);

        assertEquals(1, documents.length);
        assertNull(documents[0].getPreviewUrl());
    }

    @Test
    @DisplayName("Preview: corrupt image still confirms but has no previewUrl")
    void preview_corruptImage_confirmsWithoutPreview() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Turín");

        DocumentUploadResponse uploadResponse = initUpload(token, tripId, "rota.png", "image/png");
        uploadBytesToMinio(uploadResponse.getUploadUrl(), "esto no es un png".getBytes());
        confirmUpload(token, tripId, uploadResponse.getDocumentId());

        MvcResult result = mockMvc.perform(get("/trips/{tripId}/documents", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        DocumentResponse[] documents = objectMapper.readValue(
                result.getResponse().getContentAsString(), DocumentResponse[].class);

        assertEquals(1, documents.length);
        assertNull(documents[0].getPreviewUrl());
    }

    @Test
    @DisplayName("Preview: deleting an image document removes its thumbnail from storage")
    void preview_deleteImageDocument_removesThumbnailObject() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Génova");

        DocumentUploadResponse uploadResponse = initUpload(token, tripId, "foto.png", "image/png");
        uploadBytesToMinio(uploadResponse.getUploadUrl(), pngBytes(1200, 800));
        confirmUpload(token, tripId, uploadResponse.getDocumentId());

        mockMvc.perform(delete("/trips/{tripId}/documents/{documentId}", tripId, uploadResponse.getDocumentId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        try (software.amazon.awssdk.services.s3.S3Client s3 = software.amazon.awssdk.services.s3.S3Client.builder()
                .endpointOverride(URI.create("http://localhost:" + minio.getMappedPort(9000)))
                .credentialsProvider(software.amazon.awssdk.auth.credentials.StaticCredentialsProvider.create(
                        software.amazon.awssdk.auth.credentials.AwsBasicCredentials.create("admin", "password123")))
                .region(software.amazon.awssdk.regions.Region.US_EAST_1)
                .serviceConfiguration(software.amazon.awssdk.services.s3.S3Configuration.builder()
                        .pathStyleAccessEnabled(true).build())
                .build()) {
            var objects = s3.listObjectsV2(b -> b.bucket("telaria-document-sharing").prefix(tripId + "/"));
            assertEquals(0, objects.keyCount(), "expected no objects (original + thumbnail) left for the trip");
        }
    }

    // -------------------------------------------------------------------------
    // Complete flow
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Complete flow: init -> upload -> confirm -> list -> download -> delete")
    void completeFlow_uploadAndDownload() throws Exception {
        String token = registerAndObtainToken("uploader");
        UUID tripId = createTrip(token, "Viaje a Reikiavik");

        DocumentUploadResponse uploadResponse = initUpload(token, tripId, "billete.pdf");
        assertNotNull(uploadResponse.getDocumentId());
        assertNotNull(uploadResponse.getUploadUrl());

        uploadFileToMinio(uploadResponse.getUploadUrl());
        confirmUpload(token, tripId, uploadResponse.getDocumentId());

        MvcResult listResult = mockMvc.perform(get("/trips/{tripId}/documents", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        DocumentResponse[] documents = objectMapper.readValue(
                listResult.getResponse().getContentAsString(), DocumentResponse[].class);

        assertEquals(1, documents.length);
        assertEquals("billete.pdf", documents[0].getName());
        assertEquals(uploadResponse.getDocumentId(), documents[0].getId());

        MvcResult downloadResult = mockMvc.perform(get("/trips/{tripId}/documents/{documentId}",
                        tripId, uploadResponse.getDocumentId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        DocumentDownloadResponse downloadResponse = objectMapper.readValue(
                downloadResult.getResponse().getContentAsString(), DocumentDownloadResponse.class);

        assertNotNull(downloadResponse.getDownloadUrl());

        mockMvc.perform(delete("/trips/{tripId}/documents/{documentId}",
                        tripId, uploadResponse.getDocumentId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        MvcResult finalListResult = mockMvc.perform(get("/trips/{tripId}/documents", tripId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        DocumentResponse[] finalDocuments = objectMapper.readValue(
                finalListResult.getResponse().getContentAsString(), DocumentResponse[].class);

        assertEquals(0, finalDocuments.length);
    }
}
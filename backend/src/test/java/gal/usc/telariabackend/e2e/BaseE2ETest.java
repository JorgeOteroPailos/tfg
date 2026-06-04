package gal.usc.telariabackend.e2e;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;

import java.io.IOException;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.DisplayName.class)
public abstract class BaseE2ETest {

    static final GenericContainer<?> minio = new GenericContainer<>("minio/minio:latest")
            .withEnv("MINIO_ROOT_USER", "admin")
            .withEnv("MINIO_ROOT_PASSWORD", "password123")
            .withExposedPorts(9000)
            .withCommand("server /data");

    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
            .withDatabaseName("telaria")
            .withUsername("telaria")
            .withPassword("telaria");

    static {
        postgres.start();
        minio.start();
    }

    @DynamicPropertySource
    static void Properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");

        registry.add("minio.endpoint", () -> "http://localhost:" + minio.getMappedPort(9000));
        registry.add("minio.access-key", () -> "admin");
        registry.add("minio.secret-key", () -> "password123");
        registry.add("minio.bucket", () -> "telaria-document-sharing");
        registry.add("minio.public-endpoint", () -> "http://localhost:" + minio.getMappedPort(9000));
    }

    @BeforeAll
    static void createBucket() throws IOException, InterruptedException {
        minio.execInContainer("mc", "alias", "set", "local",
                "http://localhost:9000", "admin", "password123");
        minio.execInContainer("mc", "mb", "local/telaria-document-sharing");
    }
}

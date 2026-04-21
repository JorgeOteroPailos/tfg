plugins {
    java
    id("org.springframework.boot") version "4.0.2"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "gal.usc"
version = "0.0.1-SNAPSHOT"
description = "tripi-backend"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter")
    implementation("org.springframework.boot:spring-boot-starter-web")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    // JPA
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")

    // Base de datos H2
    runtimeOnly("com.h2database:h2")
    developmentOnly("org.springframework.boot:spring-boot-h2console")
    developmentOnly("org.springframework.boot:spring-boot-devtools")

    // Validación (DTO validation)
    implementation("org.springframework.boot:spring-boot-starter-validation")

    // Seguridad (si vas a usar login / JWT)
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server")
    implementation("org.springframework.security:spring-security-oauth2-jose")

    //jwt
    implementation("io.jsonwebtoken:jjwt-api:0.13.0")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.13.0")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.13.0")
}

tasks.withType<Test> {
    useJUnitPlatform()
}

plugins {
    java
    id("org.springframework.boot") version "4.0.2"
    id("io.spring.dependency-management") version "1.1.7"
    jacoco
    id("org.openapi.generator") version "7.16.0"
}

group = "gal.usc"
version = "0.0.1-SNAPSHOT"
description = "tripi-backend"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

jacoco {
    toolVersion = "0.8.13"
}

tasks.test {
    useJUnitPlatform()
    finalizedBy(tasks.jacocoTestReport)
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports {
        xml.required.set(true)
        html.required.set(true)
        csv.required.set(false)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter")
    implementation("org.springframework.boot:spring-boot-starter-web")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    // JPA
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")

    //BD postgre
    runtimeOnly("org.postgresql:postgresql")
    developmentOnly("org.springframework.boot:spring-boot-devtools")

    // Validation (DTO validation)
    implementation("org.springframework.boot:spring-boot-starter-validation")

    // Security
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server")
    implementation("org.springframework.security:spring-security-oauth2-jose")

    // OpenAPI / Swagger UI
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.8")
    //TODO ver este warning

    // Tests
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.testcontainers:postgresql:1.20.4")
    testImplementation("org.springframework.security:spring-security-test")

    //Lombok
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")
    testCompileOnly("org.projectlombok:lombok")
    testAnnotationProcessor("org.projectlombok:lombok")

    // MinIO / AWS S3
    implementation("software.amazon.awssdk:s3:2.31.43")

    //TestContainers
    testImplementation("org.testcontainers:testcontainers:1.20.4")
    testImplementation("org.testcontainers:junit-jupiter:1.20.4")
}

openApiGenerate {
    generatorName.set("spring")
    inputSpec.set("$rootDir/src/main/resources/openapi/api.yaml")
    outputDir.set(layout.buildDirectory.dir("generated").get().asFile.absolutePath)
    apiPackage.set("gal.usc.telariabackend.controllers")
    modelPackage.set("gal.usc.telariabackend.model.dto")
    configOptions.set(mapOf(
        "interfaceOnly"      to "true",
        "useSpringBoot3"     to "true",
        "useJakartaEe"       to "true",
        "openApiNullable"    to "false",
        "generateModels"     to "true",
        "useBeanValidation"  to "true",
        "performBeanValidation" to "true",
        "useTags" to "true",
        "serverSentEvents"      to "true"
    ))
}

tasks.withType<JavaCompile> {
    dependsOn(tasks.openApiGenerate)
}

tasks.named("openApiGenerate") {
    doFirst {
        System.setProperty("file.encoding", "UTF-8")
    }
}

sourceSets {
    main {
        java {
            srcDir(layout.buildDirectory.dir("generated/src/main/java"))
        }
    }
}

tasks.named("build") {
    dependsOn("generateFrontendTypes")
}

tasks.withType<Test> {
    useJUnitPlatform()
}

tasks.register("generateFrontendTypes", Exec::class) {
    inputs.files(fileTree("src/main/resources").include("**/*.yaml"))
    outputs.file("../frontend/src/generated/types.ts")

    workingDir("../frontend")
    commandLine("npm", "run", "generate:types")
}

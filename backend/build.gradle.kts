plugins {
    java
    id("org.springframework.boot") version "4.0.2"
    id("io.spring.dependency-management") version "1.1.7"
    jacoco
    id("org.openapi.generator") version "7.12.0"
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

    // Base de datos H2
    runtimeOnly("com.h2database:h2")
    developmentOnly("org.springframework.boot:spring-boot-h2console")
    developmentOnly("org.springframework.boot:spring-boot-devtools")

    // Validación (DTO validation)
    implementation("org.springframework.boot:spring-boot-starter-validation")

    // Seguridad
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server")
    implementation("org.springframework.security:spring-security-oauth2-jose")

    // OpenAPI / Swagger UI
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.8")
    //TODO ver este warning

    // Tests
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    // Lo ponemos x2 x si lo quito del normal //TODO revisar
    testImplementation("com.h2database:h2")
    testImplementation("org.springframework.security:spring-security-test")
}

openApiGenerate {
    generatorName.set("spring")
    inputSpec.set("$rootDir/src/main/resources/openapi/api.yaml")
    outputDir.set(layout.buildDirectory.dir("generated").get().asFile.absolutePath)
    apiPackage.set("gal.usc.telariabackend.controllers")
    modelPackage.set("gal.usc.telariabackend.model.DTO")
    configOptions.set(mapOf(
        "interfaceOnly"      to "true",
        "useSpringBoot3"     to "true",
        "useJakartaEe"       to "true",
        "openApiNullable"    to "false",
        "generateModels"     to "true",
        "useBeanValidation"  to "true",
        "performBeanValidation" to "true",
    ))
}

tasks.compileJava {
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

tasks.withType<Test> {
    useJUnitPlatform()
}

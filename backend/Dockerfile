FROM eclipse-temurin:25-jdk AS builder

WORKDIR /workspace

COPY .mvn .mvn
COPY mvnw pom.xml sonar-project.properties ./
RUN chmod +x mvnw

COPY src src

RUN ./mvnw --batch-mode \
    '-Pdev,!webapp' \
    -Dmaven.test.skip=true \
    -Dspotless.skip=true \
    -Djacoco.skip=true \
    -Dmodernizer.skip=true \
    package

FROM eclipse-temurin:25-jre-noble

WORKDIR /app

RUN useradd --system --uid 10001 beefcare
COPY --from=builder /workspace/target/*.jar /app/beefcare.jar

USER beefcare

ENV SPRING_PROFILES_ACTIVE=prod
ENV SPRING_DOCKER_COMPOSE_ENABLED=false

EXPOSE 8080

CMD ["sh", "-c", "exec java -Dserver.port=${PORT:-8080} -jar /app/beefcare.jar"]

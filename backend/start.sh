#!/bin/bash
if nvidia-smi &>/dev/null; then
    podman compose --profile gpu up -d
else
    podman compose up -d
fi

echo "Esperando a Ollama..."
until curl -s http://localhost:11434 &>/dev/null; do
    sleep 2
done

podman compose exec ollama ollama pull llama3.2:3b

echo "Esperando a Postgres..."
until podman compose exec postgres pg_isready -U telaria &>/dev/null; do
    sleep 2
done

./gradlew bootRun
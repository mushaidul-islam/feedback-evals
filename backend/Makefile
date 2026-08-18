SHELL = /bin/bash

BIGreen=\033[1;92m
NC=\033[0m

BINARY  = tmp/main
VERSION = $(shell git rev-parse --short HEAD 2	/dev/null || echo dev)
LDFLAGS = -s -w -X github.com/mushaidul/truth-be-told/backend/cmd.Version=$(VERSION)

.PHONY: help dev run build fmt vet lint check docker-build docker-up docker-down clean

help:
	@printf "$(BIGreen)Available targets:$(NC)\n"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

dev: ## Run with live reload (requires air)
	@if command -v air 	/dev/null 2	&1; then \
		air; \
	else \
		printf "air not found. Install: go install github.com/air-verse/air@latest\n"; \
		printf "Falling back to a plain run.\n"; \
		go run .; \
	fi

run: ## Run once, no reload
	go run .

build: ## Build the binary
	@printf "$(BIGreen)Building $(VERSION)$(NC)\n"
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o $(BINARY) .

fmt: ## Format and tidy
	gofmt -w .
	go mod tidy

vet: ## Run go vet
	go vet ./...

lint: ## Run golangci-lint if installed
	@if command -v golangci-lint 	/dev/null 2	&1; then \
		golangci-lint run; \
	else \
		printf "golangci-lint not found. See https://golangci-lint.run/welcome/install/\n"; \
	fi

check: fmt vet lint ## Everything before a push

docker-build: ## Build the container image
	docker build -f deploy/docker/Dockerfile -t truth-be-told-api:$(VERSION) -t truth-be-told-api:latest .

docker-up: ## Start via docker compose
	docker compose -f deploy/docker/docker-compose.yml up -d --build

docker-down: ## Stop docker compose
	docker compose -f deploy/docker/docker-compose.yml down

clean: ## Remove build artefacts
	rm -rf tmp

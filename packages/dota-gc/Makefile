.PHONY: all proto build run clean docker test

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod

BINARY_NAME=dota-gc
MAIN_PATH=./cmd/server

all: proto build

# Generate proto files
proto:
	protoc --go_out=. --go_opt=paths=source_relative \
		--go-grpc_out=. --go-grpc_opt=paths=source_relative \
		proto/lobby.proto

# Build the binary
build:
	$(GOBUILD) -o $(BINARY_NAME) $(MAIN_PATH)

# Build for Linux
build-linux:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) -o $(BINARY_NAME)-linux $(MAIN_PATH)

# Run the application
run:
	$(GOBUILD) -o $(BINARY_NAME) $(MAIN_PATH)
	./$(BINARY_NAME)

# Run with debug
run-debug:
	DEBUG=true $(GOBUILD) -o $(BINARY_NAME) $(MAIN_PATH)
	./$(BINARY_NAME)

# Clean build files
clean:
	$(GOCLEAN)
	rm -f $(BINARY_NAME)
	rm -f $(BINARY_NAME)-linux

# Download dependencies
deps:
	$(GOMOD) download
	$(GOMOD) tidy

# Install protoc plugins
install-proto-tools:
	$(GOGET) google.golang.org/protobuf/cmd/protoc-gen-go@latest
	$(GOGET) google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Run tests
test:
	$(GOTEST) -v ./...

# Build Docker image
docker:
	docker build -t dota-gc:latest .

# Run Docker container
docker-run:
	docker run -it --rm \
		-p 50051:50051 \
		-p 8080:8080 \
		-e STEAM_BOT_USERNAME=${STEAM_BOT_USERNAME} \
		-e STEAM_BOT_PASSWORD=${STEAM_BOT_PASSWORD} \
		-e STEAM_BOT_GUARD_CODE=${STEAM_BOT_GUARD_CODE} \
		dota-gc:latest

# Lint
lint:
	golangci-lint run ./...

# Format code
fmt:
	$(GOCMD) fmt ./...

# Help
help:
	@echo "Available targets:"
	@echo "  all          - Generate proto and build"
	@echo "  proto        - Generate Go code from proto files"
	@echo "  build        - Build the binary"
	@echo "  build-linux  - Build for Linux"
	@echo "  run          - Build and run"
	@echo "  run-debug    - Build and run with debug logging"
	@echo "  clean        - Clean build files"
	@echo "  deps         - Download dependencies"
	@echo "  test         - Run tests"
	@echo "  docker       - Build Docker image"
	@echo "  docker-run   - Run Docker container"
	@echo "  lint         - Run linter"
	@echo "  fmt          - Format code"

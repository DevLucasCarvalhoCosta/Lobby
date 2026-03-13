# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install protoc dependencies
RUN apk add --no-cache git make protobuf-dev

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Generate proto files
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
RUN make proto

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -o /dota-gc ./cmd/server

# Runtime stage
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /dota-gc /app/dota-gc

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

EXPOSE 50051 8080

ENTRYPOINT ["/app/dota-gc"]

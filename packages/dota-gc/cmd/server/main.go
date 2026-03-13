package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/dota-league/dota-gc/internal/api/grpc"
	"github.com/dota-league/dota-gc/internal/api/http"
	"github.com/dota-league/dota-gc/internal/bot"
	"github.com/dota-league/dota-gc/internal/config"
)

func main() {
	log.Println("Starting Dota 2 GC Service...")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Create context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize the Dota 2 bot client
	botClient, err := bot.NewClient(ctx, cfg)
	if err != nil {
		log.Fatalf("Failed to create bot client: %v", err)
	}

	// Start the bot connection in a goroutine
	go func() {
		if err := botClient.Connect(); err != nil {
			log.Printf("Bot connection error: %v", err)
		}
	}()

	// Wait for bot to be ready
	log.Println("Waiting for bot to connect to Steam and Dota 2 GC...")
	if err := botClient.WaitReady(ctx); err != nil {
		log.Fatalf("Bot failed to become ready: %v", err)
	}
	log.Println("Bot connected and ready!")

	// Start gRPC server
	grpcServer := grpc.NewServer(botClient, cfg.GRPCPort)
	go func() {
		if err := grpcServer.Start(); err != nil {
			log.Printf("gRPC server error: %v", err)
		}
	}()
	log.Printf("gRPC server listening on port %d", cfg.GRPCPort)

	// Start HTTP server (health checks, metrics)
	httpServer := http.NewServer(botClient, cfg.HTTPPort)
	go func() {
		if err := httpServer.Start(); err != nil {
			log.Printf("HTTP server error: %v", err)
		}
	}()
	log.Printf("HTTP server listening on port %d", cfg.HTTPPort)

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Println("Shutting down...")

	// Graceful shutdown
	httpServer.Stop()
	grpcServer.Stop()
	botClient.Disconnect()

	log.Println("Shutdown complete")
}

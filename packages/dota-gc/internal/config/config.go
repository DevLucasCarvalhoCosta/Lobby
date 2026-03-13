package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all configuration for the Dota GC service
type Config struct {
	// Steam credentials
	SteamUsername   string
	SteamPassword   string
	SteamGuardCode  string // Optional: Steam Guard code if 2FA is required

	// Server ports
	GRPCPort int
	HTTPPort int

	// Lobby defaults
	DefaultServerRegion int
	DefaultGameMode     int

	// NestJS API URL for webhooks
	NestJSWebhookURL string

	// Debug mode
	Debug bool
}

// Load reads configuration from environment variables
func Load() (*Config, error) {
	cfg := &Config{
		SteamUsername:       os.Getenv("STEAM_BOT_USERNAME"),
		SteamPassword:       os.Getenv("STEAM_BOT_PASSWORD"),
		SteamGuardCode:      os.Getenv("STEAM_BOT_GUARD_CODE"),
		NestJSWebhookURL:    getEnvOrDefault("NESTJS_WEBHOOK_URL", "http://localhost:3001/api/lobby/webhook"),
		Debug:               os.Getenv("DEBUG") == "true",
	}

	// Parse ports
	var err error
	cfg.GRPCPort, err = strconv.Atoi(getEnvOrDefault("GRPC_PORT", "50051"))
	if err != nil {
		return nil, fmt.Errorf("invalid GRPC_PORT: %w", err)
	}

	cfg.HTTPPort, err = strconv.Atoi(getEnvOrDefault("HTTP_PORT", "8080"))
	if err != nil {
		return nil, fmt.Errorf("invalid HTTP_PORT: %w", err)
	}

	// Parse defaults
	cfg.DefaultServerRegion, err = strconv.Atoi(getEnvOrDefault("DEFAULT_SERVER_REGION", "10")) // 10 = Brazil
	if err != nil {
		return nil, fmt.Errorf("invalid DEFAULT_SERVER_REGION: %w", err)
	}

	cfg.DefaultGameMode, err = strconv.Atoi(getEnvOrDefault("DEFAULT_GAME_MODE", "1")) // 1 = All Pick
	if err != nil {
		return nil, fmt.Errorf("invalid DEFAULT_GAME_MODE: %w", err)
	}

	// Validate required fields
	if cfg.SteamUsername == "" {
		return nil, fmt.Errorf("STEAM_BOT_USERNAME is required")
	}
	if cfg.SteamPassword == "" {
		return nil, fmt.Errorf("STEAM_BOT_PASSWORD is required")
	}

	return cfg, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// ServerRegion constants matching Dota 2 regions
const (
	RegionUSWest       = 1
	RegionUSEast       = 2
	RegionEurope       = 3
	RegionKorea        = 4
	RegionSingapore    = 5
	RegionDubai        = 6
	RegionAustralia    = 7
	RegionStockholm    = 8
	RegionAustria      = 9
	RegionBrazil       = 10
	RegionSouthAfrica  = 11
	RegionChile        = 14
	RegionPeru         = 15
	RegionIndia        = 16
	RegionJapan        = 19
)

// GameMode constants matching Dota 2 game modes
const (
	GameModeAllPick      = 1
	GameModeCaptainsMode = 2
	GameModeRandomDraft  = 3
	GameModeSingleDraft  = 4
	GameModeAllRandom    = 5
)

package http

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/dota-league/dota-gc/internal/bot"
)

// Server provides HTTP endpoints for health checks and simple REST API
type Server struct {
	bot        *bot.Client
	port       int
	httpServer *http.Server
	startTime  time.Time
}

// NewServer creates a new HTTP server
func NewServer(botClient *bot.Client, port int) *Server {
	return &Server{
		bot:       botClient,
		port:      port,
		startTime: time.Now(),
	}
}

// Start starts the HTTP server
func (s *Server) Start() error {
	mux := http.NewServeMux()

	// Health check endpoints
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/ready", s.handleReady)

	// Status endpoints
	mux.HandleFunc("/status", s.handleStatus)
	mux.HandleFunc("/lobby", s.handleLobby)

	s.httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%d", s.port),
		Handler: mux,
	}

	log.Printf("HTTP server starting on port %d", s.port)
	return s.httpServer.ListenAndServe()
}

// Stop gracefully stops the server
func (s *Server) Stop() {
	if s.httpServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		s.httpServer.Shutdown(ctx)
	}
}

// handleHealth returns basic health status
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

// handleReady returns whether the bot is connected and ready
func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if s.bot.IsReady() {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"ready":  true,
			"status": "connected to Dota 2 GC",
		})
	} else {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"ready":  false,
			"status": "not connected to Dota 2 GC",
		})
	}
}

// handleStatus returns detailed bot status
func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	lobby := s.bot.GetCurrentLobby()
	inLobby := lobby != nil
	var lobbyID uint64
	var lobbyName string
	if inLobby {
		lobbyID = lobby.GetLobbyId()
		lobbyName = lobby.GetGameName()
	}

	status := map[string]interface{}{
		"ready":          s.bot.IsReady(),
		"uptime_seconds": int64(time.Since(s.startTime).Seconds()),
		"in_lobby":       inLobby,
		"lobby_id":       lobbyID,
		"lobby_name":     lobbyName,
		"time":           time.Now().UTC().Format(time.RFC3339),
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(status)
}

// handleLobby returns current lobby state
func (s *Server) handleLobby(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	lobby := s.bot.GetCurrentLobby()
	if lobby == nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"in_lobby": false,
		})
		return
	}

	members := make([]map[string]interface{}, 0)
	for _, m := range lobby.GetAllMembers() {
		members = append(members, map[string]interface{}{
			"steam_id":   m.GetId(),
			"account_id": uint32(m.GetId() & 0xFFFFFFFF),
			"name":       m.GetName(),
			"team":       m.GetTeam().String(),
			"slot":       m.GetSlot(),
		})
	}

	state := map[string]interface{}{
		"in_lobby":      true,
		"lobby_id":      lobby.GetLobbyId(),
		"name":          lobby.GetGameName(),
		"password":      lobby.GetPassKey(),
		"status":        lobby.GetState().String(),
		"server_region": lobby.GetServerRegion(),
		"game_mode":     lobby.GetGameMode(),
		"match_id":      lobby.GetMatchId(),
		"members":       members,
		"member_count":  len(members),
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(state)
}

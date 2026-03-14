package http

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
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

	// Lobby management endpoints
	mux.HandleFunc("/lobby/create", s.handleCreateLobby)
	mux.HandleFunc("/lobby/invite", s.handleInvitePlayers)
	mux.HandleFunc("/lobby/launch", s.handleLaunchLobby)
	mux.HandleFunc("/lobby/destroy", s.handleDestroyLobby)

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

// CreateLobbyRequest represents the JSON body for creating a lobby
type CreateLobbyRequest struct {
	Name            string   `json:"name"`
	Password        string   `json:"password"`
	ServerRegion    uint32   `json:"serverRegion"`
	GameMode        uint32   `json:"gameMode"`
	AllowCheats     bool     `json:"allowCheats"`
	AllowSpectators bool     `json:"allowSpectators"`
	InviteSteamIds  []uint64 `json:"inviteSteamIds"`
	PlayerSteamIds  []string `json:"playerSteamIds"`
}

// handleCreateLobby creates a new Dota 2 lobby
func (s *Server) handleCreateLobby(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}

	var req CreateLobbyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid JSON: " + err.Error()})
		return
	}

	// Use default values if not provided
	serverRegion := req.ServerRegion
	if serverRegion == 0 {
		serverRegion = 10 // Default: South America
	}
	gameMode := req.GameMode
	if gameMode == 0 {
		gameMode = 1 // Default: All Pick
	}

	log.Printf("Creating lobby with region=%d, mode=%d", serverRegion, gameMode)

	// Create lobby options
	opts := &bot.LobbyOptions{
		Name:         req.Name,
		Password:     req.Password,
		ServerRegion: serverRegion,
		GameMode:     gameMode,
		AllowCheats:  req.AllowCheats,
		AllowSpec:    req.AllowSpectators,
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	lobby, err := s.bot.CreateLobby(ctx, opts)
	if err != nil {
		log.Printf("Failed to create lobby: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Convert playerSteamIds (strings) to uint64 and merge with inviteSteamIds
	var allInvites []uint64
	allInvites = append(allInvites, req.InviteSteamIds...)
	for _, sid := range req.PlayerSteamIds {
		if steamId, err := strconv.ParseUint(sid, 10, 64); err == nil {
			allInvites = append(allInvites, steamId)
		} else {
			log.Printf("Warning: failed to parse steam ID %s: %v", sid, err)
		}
	}

	// Invite players if provided
	if len(allInvites) > 0 {
		if err := s.bot.InvitePlayersToLobby(ctx, allInvites); err != nil {
			log.Printf("Warning: some invites may have failed: %v", err)
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"lobby_id":  lobby.GetLobbyId(),
		"password":  req.Password,
	})
}

// InviteRequest represents the JSON body for inviting players
type InviteRequest struct {
	SteamIds []uint64 `json:"steam_ids"`
}

// handleInvitePlayers invites players to the current lobby
func (s *Server) handleInvitePlayers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}

	var req InviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid JSON: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	if err := s.bot.InvitePlayersToLobby(ctx, req.SteamIds); err != nil {
		log.Printf("Failed to invite players: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// handleLaunchLobby starts the match
func (s *Server) handleLaunchLobby(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	if err := s.bot.LaunchLobby(ctx); err != nil {
		log.Printf("Failed to launch lobby: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// handleDestroyLobby destroys the current lobby
func (s *Server) handleDestroyLobby(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if err := s.bot.LeaveLobby(ctx); err != nil {
		log.Printf("Failed to destroy lobby: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

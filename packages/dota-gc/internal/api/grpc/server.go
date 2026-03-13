package grpc

import (
	"context"
	"fmt"
	"log"
	"net"
	"time"

	gcmm "github.com/paralin/go-dota2/protocol"
	"google.golang.org/grpc"

	"github.com/dota-league/dota-gc/internal/bot"
	pb "github.com/dota-league/dota-gc/proto"
)

// Server implements the gRPC LobbyService
type Server struct {
	pb.UnimplementedLobbyServiceServer
	bot        *bot.Client
	port       int
	grpcServer *grpc.Server
	startTime  time.Time
}

// NewServer creates a new gRPC server
func NewServer(botClient *bot.Client, port int) *Server {
	return &Server{
		bot:       botClient,
		port:      port,
		startTime: time.Now(),
	}
}

// Start starts the gRPC server
func (s *Server) Start() error {
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", s.port))
	if err != nil {
		return fmt.Errorf("failed to listen: %w", err)
	}

	s.grpcServer = grpc.NewServer()
	pb.RegisterLobbyServiceServer(s.grpcServer, s)

	log.Printf("gRPC server starting on port %d", s.port)
	return s.grpcServer.Serve(lis)
}

// Stop gracefully stops the server
func (s *Server) Stop() {
	if s.grpcServer != nil {
		s.grpcServer.GracefulStop()
	}
}

// CreateLobby creates a new Dota 2 practice lobby
func (s *Server) CreateLobby(ctx context.Context, req *pb.CreateLobbyRequest) (*pb.CreateLobbyResponse, error) {
	log.Printf("gRPC: CreateLobby request: name=%s, region=%d", req.Name, req.ServerRegion)

	opts := &bot.LobbyOptions{
		Name:         req.Name,
		Password:     req.Password,
		ServerRegion: req.ServerRegion,
		GameMode:     req.GameMode,
		AllowCheats:  req.AllowCheats,
		AllowSpec:    req.AllowSpectators,
	}

	lobby, err := s.bot.CreateLobby(ctx, opts)
	if err != nil {
		return &pb.CreateLobbyResponse{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	// Invite players if provided
	if len(req.InviteSteamIds) > 0 {
		if err := s.bot.InvitePlayersToLobby(ctx, req.InviteSteamIds); err != nil {
			log.Printf("Warning: some invites may have failed: %v", err)
		}
	}

	return &pb.CreateLobbyResponse{
		Success:  true,
		LobbyId:  lobby.GetLobbyId(),
		Password: req.Password,
	}, nil
}

// InvitePlayers invites players to the current lobby
func (s *Server) InvitePlayers(ctx context.Context, req *pb.InvitePlayersRequest) (*pb.InvitePlayersResponse, error) {
	log.Printf("gRPC: InvitePlayers request: %d players", len(req.SteamIds))

	results := make(map[uint64]bool)
	for _, steamID := range req.SteamIds {
		err := s.bot.InviteToLobby(ctx, steamID)
		results[steamID] = err == nil
		if err != nil {
			log.Printf("Failed to invite %d: %v", steamID, err)
		}
	}

	return &pb.InvitePlayersResponse{
		Success:       true,
		InviteResults: results,
	}, nil
}

// ConfigureLobby updates lobby settings
func (s *Server) ConfigureLobby(ctx context.Context, req *pb.ConfigureLobbyRequest) (*pb.ConfigureLobbyResponse, error) {
	log.Printf("gRPC: ConfigureLobby request")

	opts := &bot.LobbyOptions{
		Name:         req.Name,
		Password:     req.Password,
		ServerRegion: req.ServerRegion,
		GameMode:     req.GameMode,
		AllowCheats:  req.AllowCheats,
		AllowSpec:    req.AllowSpectators,
	}

	if err := s.bot.ConfigureLobby(ctx, opts); err != nil {
		return &pb.ConfigureLobbyResponse{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &pb.ConfigureLobbyResponse{Success: true}, nil
}

// LaunchLobby starts the game
func (s *Server) LaunchLobby(ctx context.Context, req *pb.LaunchLobbyRequest) (*pb.LaunchLobbyResponse, error) {
	log.Printf("gRPC: LaunchLobby request")

	if err := s.bot.LaunchLobby(ctx); err != nil {
		return &pb.LaunchLobbyResponse{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	// Get match ID from lobby state
	lobby := s.bot.GetCurrentLobby()
	var matchID uint64
	if lobby != nil {
		matchID = lobby.GetMatchId()
	}

	return &pb.LaunchLobbyResponse{
		Success: true,
		MatchId: matchID,
	}, nil
}

// LeaveLobby leaves the current lobby
func (s *Server) LeaveLobby(ctx context.Context, req *pb.LeaveLobbyRequest) (*pb.LeaveLobbyResponse, error) {
	log.Printf("gRPC: LeaveLobby request")

	if err := s.bot.LeaveLobby(ctx); err != nil {
		return &pb.LeaveLobbyResponse{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &pb.LeaveLobbyResponse{Success: true}, nil
}

// DestroyLobby destroys the current lobby
func (s *Server) DestroyLobby(ctx context.Context, req *pb.DestroyLobbyRequest) (*pb.DestroyLobbyResponse, error) {
	log.Printf("gRPC: DestroyLobby request")

	if err := s.bot.DestroyLobby(ctx); err != nil {
		return &pb.DestroyLobbyResponse{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &pb.DestroyLobbyResponse{Success: true}, nil
}

// GetLobbyState returns the current lobby state
func (s *Server) GetLobbyState(ctx context.Context, req *pb.GetLobbyStateRequest) (*pb.LobbyState, error) {
	lobby := s.bot.GetCurrentLobby()
	if lobby == nil {
		return &pb.LobbyState{InLobby: false}, nil
	}

	state := &pb.LobbyState{
		InLobby:      true,
		LobbyId:      lobby.GetLobbyId(),
		Name:         lobby.GetGameName(),
		Password:     lobby.GetPassKey(),
		Status:       convertLobbyStatus(lobby.GetState()),
		ServerRegion: lobby.GetServerRegion(),
		GameMode:     lobby.GetGameMode(),
		MatchId:      lobby.GetMatchId(),
		Members:      convertMembers(lobby.GetAllMembers()),
	}

	// Count team members
	for _, member := range state.Members {
		switch member.Team {
		case pb.LobbyTeam_TEAM_RADIANT:
			state.RadiantCount++
		case pb.LobbyTeam_TEAM_DIRE:
			state.DireCount++
		}
	}

	return state, nil
}

// ShuffleTeams performs balanced shuffle
func (s *Server) ShuffleTeams(ctx context.Context, req *pb.ShuffleTeamsRequest) (*pb.ShuffleTeamsResponse, error) {
	log.Printf("gRPC: ShuffleTeams request")

	if err := s.bot.ShuffleLobbyTeams(ctx); err != nil {
		return &pb.ShuffleTeamsResponse{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &pb.ShuffleTeamsResponse{Success: true}, nil
}

// FlipTeams swaps radiant and dire
func (s *Server) FlipTeams(ctx context.Context, req *pb.FlipTeamsRequest) (*pb.FlipTeamsResponse, error) {
	log.Printf("gRPC: FlipTeams request")

	if err := s.bot.FlipLobbyTeams(ctx); err != nil {
		return &pb.FlipTeamsResponse{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &pb.FlipTeamsResponse{Success: true}, nil
}

// KickPlayer kicks a player from the lobby
func (s *Server) KickPlayer(ctx context.Context, req *pb.KickPlayerRequest) (*pb.KickPlayerResponse, error) {
	log.Printf("gRPC: KickPlayer request: accountId=%d", req.AccountId)

	if err := s.bot.KickFromLobby(ctx, req.AccountId); err != nil {
		return &pb.KickPlayerResponse{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &pb.KickPlayerResponse{Success: true}, nil
}

// StreamLobbyUpdates streams real-time lobby updates
func (s *Server) StreamLobbyUpdates(req *pb.StreamLobbyUpdatesRequest, stream pb.LobbyService_StreamLobbyUpdatesServer) error {
	log.Printf("gRPC: StreamLobbyUpdates started")

	updateCh := s.bot.GetLobbyUpdates()

	for {
		select {
		case update := <-updateCh:
			var state *pb.LobbyState
			if update.Lobby != nil {
				state = &pb.LobbyState{
					InLobby:      true,
					LobbyId:      update.Lobby.GetLobbyId(),
					Name:         update.Lobby.GetGameName(),
					Password:     update.Lobby.GetPassKey(),
					Status:       convertLobbyStatus(update.Lobby.GetState()),
					ServerRegion: update.Lobby.GetServerRegion(),
					GameMode:     update.Lobby.GetGameMode(),
					MatchId:      update.Lobby.GetMatchId(),
					Members:      convertMembers(update.Lobby.GetAllMembers()),
				}
			} else {
				state = &pb.LobbyState{InLobby: false}
			}

			pbUpdate := &pb.LobbyUpdate{
				State:     state,
				Timestamp: time.Now().Unix(),
			}

			if err := stream.Send(pbUpdate); err != nil {
				log.Printf("Error sending lobby update: %v", err)
				return err
			}

		case <-stream.Context().Done():
			log.Printf("gRPC: StreamLobbyUpdates ended")
			return stream.Context().Err()
		}
	}
}

// GetBotStatus returns the bot's connection status
func (s *Server) GetBotStatus(ctx context.Context, req *pb.GetBotStatusRequest) (*pb.BotStatus, error) {
	lobby := s.bot.GetCurrentLobby()
	inLobby := lobby != nil

	return &pb.BotStatus{
		Connected:     true,
		Ready:         s.bot.IsReady(),
		UptimeSeconds: int64(time.Since(s.startTime).Seconds()),
		InLobby:       inLobby,
	}, nil
}

// Helper functions

func convertLobbyStatus(state gcmm.CSODOTALobby_State) pb.LobbyStatus {
	switch state {
	case gcmm.CSODOTALobby_UI:
		return pb.LobbyStatus_LOBBY_STATUS_CREATED
	case gcmm.CSODOTALobby_READYUP:
		return pb.LobbyStatus_LOBBY_STATUS_WAITING
	case gcmm.CSODOTALobby_SERVERSETUP:
		return pb.LobbyStatus_LOBBY_STATUS_READY
	case gcmm.CSODOTALobby_RUN:
		return pb.LobbyStatus_LOBBY_STATUS_IN_GAME
	case gcmm.CSODOTALobby_POSTGAME:
		return pb.LobbyStatus_LOBBY_STATUS_POST_GAME
	default:
		return pb.LobbyStatus_LOBBY_STATUS_UNKNOWN
	}
}

func convertMembers(members []*gcmm.CDOTALobbyMember) []*pb.LobbyMember {
	result := make([]*pb.LobbyMember, 0, len(members))
	for _, m := range members {
		result = append(result, &pb.LobbyMember{
			SteamId:   m.GetId(),
			AccountId: uint32(m.GetId() & 0xFFFFFFFF), // Extract account ID from Steam ID
			Name:      m.GetName(),
			Team:      convertTeam(m.GetTeam()),
			Slot:      uint32(m.GetSlot()),
		})
	}
	return result
}

func convertTeam(team gcmm.DOTA_GC_TEAM) pb.LobbyTeam {
	switch team {
	case gcmm.DOTA_GC_TEAM_DOTA_GC_TEAM_GOOD_GUYS:
		return pb.LobbyTeam_TEAM_RADIANT
	case gcmm.DOTA_GC_TEAM_DOTA_GC_TEAM_BAD_GUYS:
		return pb.LobbyTeam_TEAM_DIRE
	case gcmm.DOTA_GC_TEAM_DOTA_GC_TEAM_BROADCASTER:
		return pb.LobbyTeam_TEAM_BROADCASTER
	case gcmm.DOTA_GC_TEAM_DOTA_GC_TEAM_SPECTATOR:
		return pb.LobbyTeam_TEAM_SPECTATOR
	default:
		return pb.LobbyTeam_TEAM_UNASSIGNED
	}
}

package bot

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/paralin/go-dota2"
	gcmm "github.com/paralin/go-dota2/protocol"
)

// LobbyOptions contains options for creating a lobby
type LobbyOptions struct {
	Name         string
	Password     string
	ServerRegion uint32
	GameMode     uint32
	AllowCheats  bool
	AllowSpec    bool
}

// CreateLobby creates a new Dota 2 practice lobby
func (c *Client) CreateLobby(ctx context.Context, opts *LobbyOptions) (*gcmm.CSODOTALobby, error) {
	if !c.IsReady() {
		return nil, fmt.Errorf("bot is not ready")
	}

	log.Printf("Creating lobby: %s (region=%d, mode=%d)", opts.Name, opts.ServerRegion, opts.GameMode)

	// Prepare lobby options
	lobbyDetails := &gcmm.CMsgPracticeLobbySetDetails{
		GameName:       &opts.Name,
		PassKey:        &opts.Password,
		ServerRegion:   &opts.ServerRegion,
		GameMode:       &opts.GameMode,
		AllowCheats:    &opts.AllowCheats,
		AllowSpectating: &opts.AllowSpec,
	}

	// Create the lobby
	_, err := c.dota2Client.CreateLobby(ctx, lobbyDetails)
	if err != nil {
		return nil, fmt.Errorf("failed to create lobby: %w", err)
	}

	// Wait for lobby to be created
	lobby, err := c.waitForLobby(ctx, 15*time.Second)
	if err != nil {
		return nil, fmt.Errorf("lobby creation timeout: %w", err)
	}

	log.Printf("Lobby created successfully: ID=%v", lobby.GetLobbyId())
	return lobby, nil
}

// waitForLobby waits for a lobby update after creating a lobby
func (c *Client) waitForLobby(ctx context.Context, timeout time.Duration) (*gcmm.CSODOTALobby, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	for {
		select {
		case update := <-c.lobbyUpdateCh:
			if update.Lobby != nil {
				return update.Lobby, nil
			}
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
}

// InviteToLobby invites a player to the current lobby
func (c *Client) InviteToLobby(ctx context.Context, steamID uint64) error {
	if !c.IsReady() {
		return fmt.Errorf("bot is not ready")
	}

	lobby := c.GetCurrentLobby()
	if lobby == nil {
		return fmt.Errorf("not in a lobby")
	}

	log.Printf("Inviting player %d to lobby", steamID)

	// Convert to proper Steam ID format
	steamID64 := dota2.SteamID(steamID)
	c.dota2Client.InviteLobbyMember(steamID64)

	return nil
}

// InvitePlayersToLobby invites multiple players to the lobby
func (c *Client) InvitePlayersToLobby(ctx context.Context, steamIDs []uint64) error {
	if !c.IsReady() {
		return fmt.Errorf("bot is not ready")
	}

	for _, steamID := range steamIDs {
		if err := c.InviteToLobby(ctx, steamID); err != nil {
			log.Printf("Failed to invite player %d: %v", steamID, err)
			// Continue with other invites
		}
		// Small delay between invites to avoid rate limiting
		time.Sleep(200 * time.Millisecond)
	}

	return nil
}

// KickFromLobby kicks a player from the current lobby
func (c *Client) KickFromLobby(ctx context.Context, accountID uint32) error {
	if !c.IsReady() {
		return fmt.Errorf("bot is not ready")
	}

	lobby := c.GetCurrentLobby()
	if lobby == nil {
		return fmt.Errorf("not in a lobby")
	}

	log.Printf("Kicking player %d from lobby", accountID)
	c.dota2Client.KickLobbyMember(accountID)

	return nil
}

// SetLobbyTeam sets a player to a specific team in the lobby
func (c *Client) SetLobbyTeam(ctx context.Context, team gcmm.DOTA_GC_TEAM, slot uint32) error {
	if !c.IsReady() {
		return fmt.Errorf("bot is not ready")
	}

	lobby := c.GetCurrentLobby()
	if lobby == nil {
		return fmt.Errorf("not in a lobby")
	}

	// Join the team/slot
	c.dota2Client.JoinLobbyTeam(team, slot)
	return nil
}

// ConfigureLobby updates the lobby configuration
func (c *Client) ConfigureLobby(ctx context.Context, opts *LobbyOptions) error {
	if !c.IsReady() {
		return fmt.Errorf("bot is not ready")
	}

	lobby := c.GetCurrentLobby()
	if lobby == nil {
		return fmt.Errorf("not in a lobby")
	}

	log.Printf("Configuring lobby: %s", opts.Name)

	lobbyDetails := &gcmm.CMsgPracticeLobbySetDetails{
		GameName:       &opts.Name,
		PassKey:        &opts.Password,
		ServerRegion:   &opts.ServerRegion,
		GameMode:       &opts.GameMode,
		AllowCheats:    &opts.AllowCheats,
		AllowSpectating: &opts.AllowSpec,
	}

	_, err := c.dota2Client.ConfigLobby(ctx, lobbyDetails)
	if err != nil {
		return fmt.Errorf("failed to configure lobby: %w", err)
	}

	return nil
}

// LaunchLobby starts the game
func (c *Client) LaunchLobby(ctx context.Context) error {
	if !c.IsReady() {
		return fmt.Errorf("bot is not ready")
	}

	lobby := c.GetCurrentLobby()
	if lobby == nil {
		return fmt.Errorf("not in a lobby")
	}

	log.Println("Launching lobby game...")
	c.dota2Client.LaunchLobby()

	return nil
}

// LeaveLobby leaves the current lobby
func (c *Client) LeaveLobby(ctx context.Context) error {
	if !c.IsReady() {
		return fmt.Errorf("bot is not ready")
	}

	log.Println("Leaving current lobby...")
	c.dota2Client.LeaveLobby()

	c.mu.Lock()
	c.currentLobby = nil
	c.mu.Unlock()

	return nil
}

// DestroyLobby destroys the current lobby
func (c *Client) DestroyLobby(ctx context.Context) error {
	if !c.IsReady() {
		return fmt.Errorf("bot is not ready")
	}

	lobby := c.GetCurrentLobby()
	if lobby == nil {
		return fmt.Errorf("not in a lobby")
	}

	log.Println("Destroying lobby...")
	c.dota2Client.DestroyLobby(ctx)

	c.mu.Lock()
	c.currentLobby = nil
	c.mu.Unlock()

	return nil
}

// GetLobbyMembers returns the list of members in the current lobby
func (c *Client) GetLobbyMembers() []*gcmm.CDOTALobbyMember {
	lobby := c.GetCurrentLobby()
	if lobby == nil {
		return nil
	}
	return lobby.GetAllMembers()
}

// IsLobbyReady checks if all expected players have joined the lobby
func (c *Client) IsLobbyReady(expectedPlayers int) bool {
	members := c.GetLobbyMembers()
	if members == nil {
		return false
	}

	// Count players in teams (not spectators, not unassigned)
	playersInTeams := 0
	for _, member := range members {
		team := member.GetTeam()
		if team == gcmm.DOTA_GC_TEAM_DOTA_GC_TEAM_GOOD_GUYS || team == gcmm.DOTA_GC_TEAM_DOTA_GC_TEAM_BAD_GUYS {
			playersInTeams++
		}
	}

	return playersInTeams >= expectedPlayers
}

// ShuffleLobbyTeams performs a balanced shuffle of players
func (c *Client) ShuffleLobbyTeams(ctx context.Context) error {
	if !c.IsReady() {
		return fmt.Errorf("bot is not ready")
	}

	lobby := c.GetCurrentLobby()
	if lobby == nil {
		return fmt.Errorf("not in a lobby")
	}

	log.Println("Shuffling lobby teams...")
	c.dota2Client.BalancedShuffleLobby()

	return nil
}

// FlipLobbyTeams swaps radiant and dire teams
func (c *Client) FlipLobbyTeams(ctx context.Context) error {
	if !c.IsReady() {
		return fmt.Errorf("bot is not ready")
	}

	lobby := c.GetCurrentLobby()
	if lobby == nil {
		return fmt.Errorf("not in a lobby")
	}

	log.Println("Flipping lobby teams...")
	c.dota2Client.FlipLobbyTeams()

	return nil
}

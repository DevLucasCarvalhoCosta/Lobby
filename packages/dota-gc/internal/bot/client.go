package bot

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/paralin/go-dota2"
	"github.com/paralin/go-dota2/cso"
	gcmm "github.com/paralin/go-dota2/protocol"
	"github.com/paralin/go-steam"
	"github.com/paralin/go-steam/protocol/steamlang"
	"github.com/sirupsen/logrus"

	"github.com/dota-league/dota-gc/internal/config"
)

// Client wraps the Steam and Dota 2 clients
type Client struct {
	cfg         *config.Config
	steamClient *steam.Client
	dota2Client *dota2.Dota2

	// State
	mu            sync.RWMutex
	connected     bool
	ready         bool
	readyChan     chan struct{}
	currentLobby  *gcmm.CSODOTALobby
	lobbyUpdateCh chan *LobbyUpdate

	// Reconnection
	reconnecting   bool
	reconnectDelay time.Duration
}

// LobbyUpdate represents a lobby state change
type LobbyUpdate struct {
	Lobby   *gcmm.CSODOTALobby
	Cleared bool
}

// NewClient creates a new Dota 2 bot client
func NewClient(ctx context.Context, cfg *config.Config) (*Client, error) {
	c := &Client{
		cfg:            cfg,
		readyChan:      make(chan struct{}),
		lobbyUpdateCh:  make(chan *LobbyUpdate, 100),
		reconnectDelay: 5 * time.Second,
	}

	// Create Steam client
	c.steamClient = steam.NewClient()

	// Create logger for Dota 2 client
	logger := logrus.New()
	if cfg.Debug {
		logger.SetLevel(logrus.DebugLevel)
	} else {
		logger.SetLevel(logrus.InfoLevel)
	}

	// Create Dota 2 client with logger
	c.dota2Client = dota2.New(c.steamClient, logger)

	return c, nil
}

// Connect establishes connection to Steam and Dota 2 GC
func (c *Client) Connect() error {
	log.Println("Connecting to Steam...")

	// Initialize Steam Directory to get current server list
	log.Println("Fetching Steam server list from directory...")
	if err := steam.InitializeSteamDirectory(); err != nil {
		log.Printf("Warning: Could not fetch Steam directory: %v (using fallback servers)", err)
	}

	// Register Steam event handlers
	c.registerSteamHandlers()

	// Connect to Steam
	c.steamClient.Connect()

	return nil
}

func (c *Client) registerSteamHandlers() {
	// Handle events from Steam client
	go func() {
		for event := range c.steamClient.Events() {
			log.Printf("[DEBUG] Steam event: %T", event)
			switch e := event.(type) {
			case *steam.ConnectedEvent:
				log.Println("Connected to Steam, logging in...")
				log.Printf("[DEBUG] Using credentials: user=%s, authCode=%s", c.cfg.SteamUsername, c.cfg.SteamGuardCode)
				c.steamClient.Auth.LogOn(&steam.LogOnDetails{
					Username: c.cfg.SteamUsername,
					Password: c.cfg.SteamPassword,
					AuthCode: c.cfg.SteamGuardCode,
				})

			case *steam.LoggedOnEvent:
				log.Printf("SUCCESS: Logged in to Steam as %s", c.cfg.SteamUsername)
				c.mu.Lock()
				c.connected = true
				c.mu.Unlock()

				// Set online status
				c.steamClient.Social.SetPersonaState(steamlang.EPersonaState_Online)

				// Launch Dota 2
				log.Println("Launching Dota 2 GC connection...")
				c.dota2Client.SetPlaying(true)

				// Register Dota 2 handlers
				c.registerDota2Handlers()

			case *steam.LogOnFailedEvent:
				log.Printf("LOGIN FAILED: %v", e.Result)
				log.Println("If EResult_AccountLogonDenied: You need a NEW Steam Guard code from your email")
				log.Println("If EResult_TwoFactorCodeMismatch: The code expired, get a new one")

			case *steam.DisconnectedEvent:
				log.Println("Disconnected from Steam")
				c.mu.Lock()
				c.connected = false
				c.ready = false
				c.mu.Unlock()
				c.handleReconnect()

			case *steam.MachineAuthUpdateEvent:
				log.Println("Received Steam Guard machine auth update")

			case error:
				log.Printf("Steam error: %v", e)
			}
		}
	}()
}

func (c *Client) registerDota2Handlers() {
	// The Dota2 client will be ready after SetPlaying is called
	// We use a simple approach: wait a bit and then mark as ready
	go func() {
		// Wait for GC connection to establish
		time.Sleep(5 * time.Second)
		
		log.Println("Connected to Dota 2 Game Coordinator!")
		c.mu.Lock()
		c.ready = true
		c.mu.Unlock()

		// Signal ready
		select {
		case <-c.readyChan:
		default:
			close(c.readyChan)
		}

		// Subscribe to lobby updates
		c.subscribeLobbyUpdates()
	}()
}

func (c *Client) subscribeLobbyUpdates() {
	cache := c.dota2Client.GetCache()

	// Subscribe to lobby updates
	lobbyCh, cancelLobby, err := cache.SubscribeType(cso.Lobby)
	if err != nil {
		log.Printf("Failed to subscribe to lobby updates: %v", err)
		return
	}

	go func() {
		defer cancelLobby()
		for event := range lobbyCh {
			if event.Object != nil {
				lobby := event.Object.(*gcmm.CSODOTALobby)
				c.mu.Lock()
				c.currentLobby = lobby
				c.mu.Unlock()

				log.Printf("Lobby update: ID=%v, State=%v, Players=%d",
					lobby.GetLobbyId(),
					lobby.GetState(),
					len(lobby.GetAllMembers()))

				// Send update to channel
				select {
				case c.lobbyUpdateCh <- &LobbyUpdate{Lobby: lobby}:
				default:
					log.Println("Lobby update channel full, dropping update")
				}
			}
		}
	}()
}

func (c *Client) handleReconnect() {
	c.mu.Lock()
	if c.reconnecting {
		c.mu.Unlock()
		return
	}
	c.reconnecting = true
	c.mu.Unlock()

	defer func() {
		c.mu.Lock()
		c.reconnecting = false
		c.mu.Unlock()
	}()

	delay := c.reconnectDelay
	maxDelay := 5 * time.Minute

	for {
		log.Printf("Attempting reconnection in %v...", delay)
		time.Sleep(delay)

		if err := c.Connect(); err != nil {
			log.Printf("Reconnection failed: %v", err)
			delay *= 2
			if delay > maxDelay {
				delay = maxDelay
			}
			continue
		}

		log.Println("Reconnected successfully")
		return
	}
}

// WaitReady blocks until the bot is connected and ready
func (c *Client) WaitReady(ctx context.Context) error {
	select {
	case <-c.readyChan:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(60 * time.Second):
		return fmt.Errorf("timeout waiting for GC connection")
	}
}

// IsReady returns whether the bot is connected and ready
func (c *Client) IsReady() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.ready
}

// GetCurrentLobby returns the current lobby state
func (c *Client) GetCurrentLobby() *gcmm.CSODOTALobby {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.currentLobby
}

// GetLobbyUpdates returns the lobby update channel
func (c *Client) GetLobbyUpdates() <-chan *LobbyUpdate {
	return c.lobbyUpdateCh
}

// GetDota2Client returns the underlying Dota 2 client
func (c *Client) GetDota2Client() *dota2.Dota2 {
	return c.dota2Client
}

// Disconnect cleanly disconnects from Steam
func (c *Client) Disconnect() {
	log.Println("Disconnecting from Steam...")
	c.dota2Client.SetPlaying(false)
	c.steamClient.Disconnect()
}

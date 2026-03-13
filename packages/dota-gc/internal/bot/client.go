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

	// Create Dota 2 client
	c.dota2Client = dota2.New(c.steamClient, dota2.SetDebug(cfg.Debug))

	return c, nil
}

// Connect establishes connection to Steam and Dota 2 GC
func (c *Client) Connect() error {
	log.Println("Connecting to Steam...")

	// Register Steam event handlers
	c.registerSteamHandlers()

	// Connect to Steam
	c.steamClient.Connect()

	return nil
}

func (c *Client) registerSteamHandlers() {
	// Handle connected event
	c.steamClient.Events = make(chan interface{}, 100)

	go func() {
		for event := range c.steamClient.Events {
			switch e := event.(type) {
			case *steam.ConnectedEvent:
				log.Println("Connected to Steam, logging in...")
				c.steamClient.Auth.LogOn(&steam.LogOnDetails{
					Username: c.cfg.SteamUsername,
					Password: c.cfg.SteamPassword,
					AuthCode: c.cfg.SteamGuardCode,
				})

			case *steam.LoggedOnEvent:
				log.Printf("Logged in to Steam as %s", c.cfg.SteamUsername)
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
				log.Printf("Login failed: %v", e.Result)

			case *steam.DisconnectedEvent:
				log.Println("Disconnected from Steam")
				c.mu.Lock()
				c.connected = false
				c.ready = false
				c.mu.Unlock()
				c.handleReconnect()

			case *steam.MachineAuthUpdateEvent:
				log.Println("Received Steam Guard machine auth update")
			}
		}
	}()
}

func (c *Client) registerDota2Handlers() {
	// Handle GC ready
	c.dota2Client.OnReady(func() {
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
	})

	// Handle GC welcome timeout
	c.dota2Client.OnUnready(func() {
		log.Println("Lost connection to Dota 2 GC")
		c.mu.Lock()
		c.ready = false
		c.mu.Unlock()
	})
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

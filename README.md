# 🎮 Dota League - Friend Lobby Tracker

A web platform to track Dota 2 custom lobby matches among friends. Track statistics, MMR ratings, and match history for your private league.

## Features

- **Steam Authentication** - Login with your Steam account
- **Match Detection** - Auto-detect recent custom lobby matches or manual entry
- **Glicko-2 Rating System** - Fair MMR calculation using Glicko-2 algorithm
- **Leaderboard** - Track rankings, win rates, and streaks
- **Match History** - Detailed match stats with K/D/A, GPM, damage dealt
- **Player Profiles** - Individual stats, recent matches, rating history

## Tech Stack

- **Backend**: NestJS + TypeScript + Prisma + PostgreSQL
- **Frontend**: Next.js 14 + React + Tailwind CSS + TanStack Query
- **APIs**: OpenDota API, Steam Web API
- **Auth**: Steam OpenID via Passport

## Project Structure

```
packages/
├── api/          # NestJS backend
│   ├── src/
│   │   ├── modules/       # Feature modules (players, matches, leaderboard, auth)
│   │   ├── services/      # Shared services (OpenDota, Rating, Match Detection)
│   │   └── prisma/        # Database service
│   └── prisma/
│       └── schema.prisma  # Database schema
├── web/          # Next.js frontend
│   └── src/
│       ├── app/           # App router pages
│       ├── components/    # React components
│       └── lib/           # Utilities and contexts
└── shared/       # Shared TypeScript types
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL database
- Steam API Key ([Get one here](https://steamcommunity.com/dev/apikey))

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <your-repo>
   cd Lobby
   pnpm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your values:
   ```env
   # Database - PostgreSQL connection string
   DATABASE_URL="postgresql://user:password@localhost:5432/dota_league?schema=public"
   
   # Steam API Key (required for authentication)
   STEAM_API_KEY="your_steam_api_key"
   
   # Session secret (min 32 characters, use a random string)
   SESSION_SECRET="your_long_random_secret_string_here"
   
   # URLs
   API_URL="http://localhost:3001"
   WEB_URL="http://localhost:3000"
   ```

3. **Setup database**
   ```bash
   cd packages/api
   pnpm prisma generate
   pnpm prisma db push
   ```

4. **Configure frontend**
   ```bash
   cd packages/web
   cp .env.local.example .env.local
   ```

### Running the Application

**Development mode:**

```bash
# Terminal 1 - Run API (http://localhost:3001)
pnpm --filter @dota-league/api dev

# Terminal 2 - Run Web (http://localhost:3000)
pnpm --filter @dota-league/web dev
```

**Or run both simultaneously:**
```bash
pnpm dev
```

### API Documentation

Swagger docs available at: http://localhost:3001/api/docs

## How It Works

### Match Registration

1. Player logs in via Steam
2. Clicks "Report Match" button
3. System queries OpenDota API for player's recent custom lobby matches (lobby_type = 5)
4. Matches with 100% league members are auto-detected
5. If multiple candidates exist, player selects the correct match
6. Manual match ID entry available as fallback

### MMR System (Glicko-2)

- Initial rating: 1500
- Initial deviation: 350
- Considers individual performance and opponent strengths
- Rating deviation decreases with more games played
- More accurate than simple Elo for irregular play schedules

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `STEAM_API_KEY` | Steam Web API key | Yes |
| `SESSION_SECRET` | Express session secret (32+ chars) | Yes |
| `API_URL` | Backend server URL | Yes |
| `WEB_URL` | Frontend server URL | Yes |
| `OPENDOTA_API_KEY` | OpenDota API key (optional, higher rate limits) | No |
| `NODE_ENV` | `development` or `production` | No |

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Run all packages in development mode |
| `pnpm build` | Build all packages |
| `pnpm --filter @dota-league/api prisma:studio` | Open Prisma Studio |
| `pnpm --filter @dota-league/api prisma:migrate` | Run database migrations |

## API Endpoints

### Authentication
- `GET /auth/steam` - Initiate Steam login
- `GET /auth/steam/callback` - Steam login callback
- `GET /auth/me` - Get current user
- `GET /auth/logout` - Logout

### Players
- `GET /players` - List all players
- `GET /players/:steamId` - Get player profile
- `POST /players/register` - Register new player (admin)

### Matches
- `GET /matches` - List matches (paginated)
- `GET /matches/:matchId` - Get match details
- `GET /matches/recent` - Get recent matches
- `GET /matches/detect` - Detect candidate matches for current user
- `POST /matches/register` - Register a match

### Leaderboard
- `GET /leaderboard` - Get player rankings
- `GET /leaderboard/stats` - Get league statistics

## License

MIT

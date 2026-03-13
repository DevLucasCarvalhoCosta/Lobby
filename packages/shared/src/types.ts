// ============================================
// PLAYER TYPES
// ============================================

export interface Player {
  id: string;
  steamId: string;           // Steam64 ID
  accountId: number;         // Steam32 account ID (used by Dota 2 API)
  personaName: string;
  avatar: string;
  avatarFull: string;
  profileUrl: string;
  
  // League-specific
  rating: number;            // Glicko-2 rating (default: 1500)
  ratingDeviation: number;   // Glicko-2 RD (default: 350)
  volatility: number;        // Glicko-2 volatility (default: 0.06)
  
  // Stats
  wins: number;
  losses: number;
  winStreak: number;
  lossStreak: number;
  
  createdAt: Date;
  updatedAt: Date;
  lastMatchAt: Date | null;
}

export interface PlayerStats {
  playerId: string;
  
  // Totals
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  
  // Averages
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgGpm: number;
  avgXpm: number;
  avgLastHits: number;
  avgDenies: number;
  
  // Records
  maxKills: number;
  maxDeaths: number;
  maxAssists: number;
  maxGpm: number;
  maxXpm: number;
}

export interface PlayerHeroStats {
  playerId: string;
  heroId: number;
  heroName: string;
  matches: number;
  wins: number;
  losses: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
}

// ============================================
// MATCH TYPES
// ============================================

export interface LeagueMatch {
  id: string;
  matchId: number;           // Dota 2 match ID
  
  // Match info
  startTime: Date;
  duration: number;          // seconds
  radiantWin: boolean;
  radiantScore: number;
  direScore: number;
  gameMode: number;
  
  // Players
  players: MatchPlayer[];
  
  // Detection metadata
  detectedAt: Date;
  registeredBy: 'automatic' | 'manual' | 'discord';
  reportedByPlayerId: string | null;
  
  // Rating changes applied
  ratingProcessed: boolean;
  
  createdAt: Date;
}

export interface MatchPlayer {
  id: string;
  matchId: string;
  playerId: string;
  
  // Dota 2 data
  accountId: number;
  heroId: number;
  playerSlot: number;        // 0-127 (0-4 Radiant, 128-132 Dire)
  isRadiant: boolean;
  
  // Performance
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
  xpm: number;
  lastHits: number;
  denies: number;
  heroDamage: number;
  towerDamage: number;
  heroHealing: number;
  gold: number;
  level: number;
  
  // Items (item IDs)
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  backpack0: number;
  backpack1: number;
  backpack2: number;
  
  // Rating change
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
}

// ============================================
// RATING TYPES
// ============================================

export interface RatingHistory {
  id: string;
  playerId: string;
  matchId: string;
  
  ratingBefore: number;
  ratingAfter: number;
  rdBefore: number;
  rdAfter: number;
  
  createdAt: Date;
}

export interface LeaderboardEntry {
  rank: number;
  player: Player;
  rating: number;
  wins: number;
  losses: number;
  winRate: number;
  recentForm: ('W' | 'L')[];  // Last 5 matches
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface OpenDotaPlayer {
  profile: {
    account_id: number;
    personaname: string;
    name: string | null;
    plus: boolean;
    cheese: number;
    steamid: string;
    avatar: string;
    avatarmedium: string;
    avatarfull: string;
    profileurl: string;
    last_login: string | null;
    loccountrycode: string | null;
  };
  rank_tier: number | null;
  leaderboard_rank: number | null;
}

export interface OpenDotaMatch {
  match_id: number;
  player_slot: number;
  radiant_win: boolean;
  duration: number;
  game_mode: number;
  lobby_type: number;
  hero_id: number;
  start_time: number;
  version: number | null;
  kills: number;
  deaths: number;
  assists: number;
  skill: number | null;
  average_rank: number | null;
  leaver_status: number;
  party_size: number | null;
}

export interface OpenDotaMatchDetails {
  match_id: number;
  barracks_status_dire: number;
  barracks_status_radiant: number;
  cluster: number;
  dire_score: number;
  duration: number;
  engine: number;
  first_blood_time: number;
  game_mode: number;
  human_players: number;
  leagueid: number;
  lobby_type: number;
  match_seq_num: number;
  positive_votes: number;
  negative_votes: number;
  radiant_score: number;
  radiant_win: boolean;
  start_time: number;
  tower_status_dire: number;
  tower_status_radiant: number;
  players: OpenDotaMatchPlayer[];
}

export interface OpenDotaMatchPlayer {
  account_id: number | null;
  player_slot: number;
  hero_id: number;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  gold_per_min: number;
  xp_per_min: number;
  hero_damage: number;
  tower_damage: number;
  hero_healing: number;
  gold: number;
  gold_spent: number;
  level: number;
  item_0: number;
  item_1: number;
  item_2: number;
  item_3: number;
  item_4: number;
  item_5: number;
  backpack_0: number;
  backpack_1: number;
  backpack_2: number;
  leaver_status: number;
  personaname?: string;
}

// ============================================
// LOBBY TYPES
// ============================================

export enum LobbyType {
  INVALID = -1,
  UNRANKED = 0,
  PRACTICE = 1,
  TOURNAMENT = 2,
  TUTORIAL = 3,
  COOP_BOTS = 4,
  CUSTOM = 5,         // <-- This is what we track
  SOLO_QUEUE = 6,
  RANKED = 7,
  MID_1V1 = 8,
}

export enum GameMode {
  NONE = 0,
  ALL_PICK = 1,
  CAPTAINS_MODE = 2,
  RANDOM_DRAFT = 3,
  SINGLE_DRAFT = 4,
  ALL_RANDOM = 5,
  INTRO = 6,
  DIRETIDE = 7,
  REVERSE_CAPTAINS = 8,
  GREEVILING = 9,
  TUTORIAL = 10,
  MID_ONLY = 11,
  LEAST_PLAYED = 12,
  NEW_PLAYER = 13,
  COMPENDIUM = 14,
  COOP_VS_BOTS = 15,
  CAPTAINS_DRAFT = 16,
  ABILITY_DRAFT = 18,
  ALL_RANDOM_DM = 20,
  MID_1V1 = 21,
  RANKED = 22,
  TURBO = 23,
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface ReportMatchRequest {
  matchId?: number;          // Optional - if provided, use directly
  reporterAccountId: number; // Who is reporting
}

export interface ReportMatchResponse {
  success: boolean;
  message: string;
  match?: LeagueMatch;
  pendingMatches?: PendingMatchOption[];
}

export interface PendingMatchOption {
  matchId: number;
  startTime: Date;
  duration: number;
  heroId: number;
  radiantWin: boolean;
  leagueMembersCount: number;  // How many of the 10 players are league members
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MatchFilters {
  playerId?: string;
  heroId?: number;
  startDate?: Date;
  endDate?: Date;
  result?: 'win' | 'loss';
}

// Steam ID conversion utilities
export const STEAM_ID_OFFSET = BigInt('76561197960265728');

export function steamId64ToAccountId(steamId64: string): number {
  return Number(BigInt(steamId64) - STEAM_ID_OFFSET);
}

export function accountIdToSteamId64(accountId: number): string {
  return (BigInt(accountId) + STEAM_ID_OFFSET).toString();
}

export function isRadiant(playerSlot: number): boolean {
  return playerSlot < 128;
}

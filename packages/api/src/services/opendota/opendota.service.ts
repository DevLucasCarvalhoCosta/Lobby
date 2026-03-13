import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  OpenDotaPlayer,
  OpenDotaMatch,
  OpenDotaMatchDetails,
  LobbyType,
} from '@dota-league/shared';

interface RateLimitState {
  remaining: number;
  resetAt: number;
}

@Injectable()
export class OpenDotaService {
  private readonly logger = new Logger(OpenDotaService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey?: string;
  
  // Rate limiting
  private rateLimit: RateLimitState = {
    remaining: 60,
    resetAt: Date.now() + 60000,
  };
  
  // Request queue for rate limiting
  private requestQueue: Promise<void> = Promise.resolve();

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENDOTA_API_KEY');
    
    this.client = axios.create({
      baseURL: 'https://api.opendota.com/api',
      timeout: 30000,
      params: this.apiKey ? { api_key: this.apiKey } : {},
    });

    // Add response interceptor to track rate limits
    this.client.interceptors.response.use(
      (response) => {
        // OpenDota returns rate limit info in headers
        const remaining = response.headers['x-rate-limit-remaining'];
        const reset = response.headers['x-rate-limit-reset'];
        
        if (remaining !== undefined) {
          this.rateLimit.remaining = parseInt(remaining, 10);
        }
        if (reset !== undefined) {
          this.rateLimit.resetAt = Date.now() + parseInt(reset, 10) * 1000;
        }
        
        return response;
      },
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(
            error.response.headers['retry-after'] as string || '60',
            10
          );
          this.logger.warn(`Rate limited. Waiting ${retryAfter}s before retry`);
          await this.sleep(retryAfter * 1000);
          return this.client.request(error.config!);
        }
        throw error;
      },
    );
  }

  /**
   * Make a rate-limited request
   */
  private async request<T>(fn: () => Promise<T>): Promise<T> {
    // Queue requests to avoid parallel rate limit issues
    this.requestQueue = this.requestQueue.then(async () => {
      // Check if we need to wait for rate limit reset
      if (this.rateLimit.remaining <= 1) {
        const waitTime = Math.max(0, this.rateLimit.resetAt - Date.now());
        if (waitTime > 0) {
          this.logger.debug(`Rate limit low. Waiting ${waitTime}ms`);
          await this.sleep(waitTime);
        }
      }
    });

    await this.requestQueue;
    return fn();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get player profile from OpenDota
   */
  async getPlayer(accountId: number): Promise<OpenDotaPlayer | null> {
    try {
      const response = await this.request(() =>
        this.client.get<OpenDotaPlayer>(`/players/${accountId}`)
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error(`Failed to get player ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get player's recent matches
   */
  async getPlayerMatches(
    accountId: number,
    options: {
      limit?: number;
      lobbyType?: LobbyType;
      dateHours?: number;
    } = {}
  ): Promise<OpenDotaMatch[]> {
    const { limit = 20, lobbyType, dateHours } = options;
    
    const params: Record<string, string | number> = {
      limit,
    };

    if (lobbyType !== undefined) {
      params.lobby_type = lobbyType;
    }

    if (dateHours !== undefined) {
      // OpenDota 'date' param is days, we convert hours to days
      params.date = Math.ceil(dateHours / 24);
    }

    try {
      const response = await this.request(() =>
        this.client.get<OpenDotaMatch[]>(`/players/${accountId}/matches`, { params })
      );
      
      // Filter by time if dateHours specified (more precise than API's date param)
      if (dateHours !== undefined) {
        const cutoffTime = Math.floor(Date.now() / 1000) - (dateHours * 3600);
        return response.data.filter((m) => m.start_time >= cutoffTime);
      }
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get matches for player ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get custom lobby matches for a player
   */
  async getPlayerCustomLobbyMatches(
    accountId: number,
    hoursBack: number = 2
  ): Promise<OpenDotaMatch[]> {
    return this.getPlayerMatches(accountId, {
      limit: 20,
      lobbyType: LobbyType.CUSTOM,
      dateHours: hoursBack,
    });
  }

  /**
   * Get detailed match data
   */
  async getMatchDetails(matchId: number): Promise<OpenDotaMatchDetails | null> {
    try {
      const response = await this.request(() =>
        this.client.get<OpenDotaMatchDetails>(`/matches/${matchId}`)
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error(`Failed to get match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Get match with retries (matches take 30-120s to appear in API)
   */
  async getMatchDetailsWithRetry(
    matchId: number,
    maxRetries: number = 10,
    initialDelay: number = 5000
  ): Promise<OpenDotaMatchDetails | null> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const match = await this.getMatchDetails(matchId);
      
      if (match) {
        return match;
      }

      // Exponential backoff: 5s, 10s, 15s, 20s, 25s, 30s...
      const delay = initialDelay * (attempt + 1);
      this.logger.debug(
        `Match ${matchId} not found. Retry ${attempt + 1}/${maxRetries} in ${delay}ms`
      );
      await this.sleep(delay);
    }

    this.logger.warn(`Match ${matchId} not found after ${maxRetries} retries`);
    return null;
  }

  /**
   * Search for players by name
   */
  async searchPlayers(query: string): Promise<Array<{
    account_id: number;
    personaname: string;
    avatarfull: string;
    last_match_time: string;
    similarity: number;
  }>> {
    try {
      const response = await this.request(() =>
        this.client.get('/search', { params: { q: query } })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to search players:`, error);
      throw error;
    }
  }

  /**
   * Request OpenDota to parse/refresh a match
   * Note: This counts as 10 API calls for rate limit purposes
   */
  async requestMatchParse(matchId: number): Promise<{ job: { jobId: number } }> {
    try {
      const response = await this.request(() =>
        this.client.post(`/request/${matchId}`)
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to request match parse ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Refresh player data (triggers OpenDota to re-fetch from Steam)
   */
  async refreshPlayer(accountId: number): Promise<void> {
    try {
      await this.request(() =>
        this.client.post(`/players/${accountId}/refresh`)
      );
      this.logger.debug(`Refreshed player ${accountId}`);
    } catch (error) {
      this.logger.error(`Failed to refresh player ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): RateLimitState {
    return { ...this.rateLimit };
  }
}

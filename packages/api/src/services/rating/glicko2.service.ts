import { Injectable, Logger } from '@nestjs/common';

/**
 * Glicko-2 Rating System Implementation
 * 
 * Based on: http://www.glicko.net/glicko/glicko2.pdf
 * 
 * Key parameters:
 * - Rating (r): Player skill estimate (default: 1500)
 * - Rating Deviation (RD): Uncertainty in rating (default: 350)
 * - Volatility (σ): Expected fluctuation in rating (default: 0.06)
 * 
 * System constant τ (tau): Constrains volatility change (0.3 to 1.2, we use 0.5)
 */

export interface GlickoPlayer {
  rating: number;
  rd: number;           // Rating Deviation
  volatility: number;
}

export interface GlickoResult {
  opponent: GlickoPlayer;
  score: number;        // 1 = win, 0 = loss, 0.5 = draw
}

export interface RatingChange {
  newRating: number;
  newRd: number;
  newVolatility: number;
  ratingChange: number;
}

@Injectable()
export class Glicko2Service {
  private readonly logger = new Logger(Glicko2Service.name);
  
  // System constants
  private readonly TAU = 0.5;           // Constrains volatility change
  private readonly DEFAULT_RATING = 1500;
  private readonly DEFAULT_RD = 350;
  private readonly DEFAULT_VOLATILITY = 0.06;
  private readonly CONVERGENCE_TOLERANCE = 0.000001;

  // Glicko-2 scaling constant
  private readonly Q = Math.log(10) / 400; // ~0.00575646

  /**
   * Create a new player with default rating
   */
  createPlayer(): GlickoPlayer {
    return {
      rating: this.DEFAULT_RATING,
      rd: this.DEFAULT_RD,
      volatility: this.DEFAULT_VOLATILITY,
    };
  }

  /**
   * Convert Glicko rating to Glicko-2 scale
   */
  private toGlicko2Scale(rating: number): number {
    return (rating - 1500) / 173.7178;
  }

  /**
   * Convert Glicko-2 rating back to Glicko scale
   */
  private toGlickoScale(mu: number): number {
    return mu * 173.7178 + 1500;
  }

  /**
   * Convert RD to Glicko-2 scale
   */
  private rdToGlicko2(rd: number): number {
    return rd / 173.7178;
  }

  /**
   * Convert Glicko-2 RD back to Glicko scale
   */
  private rdToGlicko(phi: number): number {
    return phi * 173.7178;
  }

  /**
   * g(φ) function - reduces impact of opponents with high RD
   */
  private g(phi: number): number {
    return 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
  }

  /**
   * E(μ, μj, φj) - Expected score against opponent
   */
  private E(mu: number, muJ: number, phiJ: number): number {
    return 1 / (1 + Math.exp(-this.g(phiJ) * (mu - muJ)));
  }

  /**
   * Calculate new rating after a match/rating period
   */
  calculateNewRating(
    player: GlickoPlayer,
    results: GlickoResult[]
  ): RatingChange {
    // Step 1: Convert to Glicko-2 scale
    const mu = this.toGlicko2Scale(player.rating);
    const phi = this.rdToGlicko2(player.rd);
    const sigma = player.volatility;

    // If no games played, just increase RD due to uncertainty
    if (results.length === 0) {
      const newPhi = Math.sqrt(phi * phi + sigma * sigma);
      return {
        newRating: player.rating,
        newRd: Math.min(this.rdToGlicko(newPhi), this.DEFAULT_RD),
        newVolatility: sigma,
        ratingChange: 0,
      };
    }

    // Step 2: Calculate v (estimated variance)
    let v = 0;
    for (const result of results) {
      const muJ = this.toGlicko2Scale(result.opponent.rating);
      const phiJ = this.rdToGlicko2(result.opponent.rd);
      const gPhiJ = this.g(phiJ);
      const eVal = this.E(mu, muJ, phiJ);
      v += gPhiJ * gPhiJ * eVal * (1 - eVal);
    }
    v = 1 / v;

    // Step 3: Calculate delta (estimated improvement)
    let delta = 0;
    for (const result of results) {
      const muJ = this.toGlicko2Scale(result.opponent.rating);
      const phiJ = this.rdToGlicko2(result.opponent.rd);
      const gPhiJ = this.g(phiJ);
      const eVal = this.E(mu, muJ, phiJ);
      delta += gPhiJ * (result.score - eVal);
    }
    delta = v * delta;

    // Step 4: Calculate new volatility using iterative algorithm
    const newSigma = this.calculateNewVolatility(phi, sigma, v, delta);

    // Step 5: Update RD
    const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
    const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);

    // Step 6: Update rating
    let newMu = mu;
    for (const result of results) {
      const muJ = this.toGlicko2Scale(result.opponent.rating);
      const phiJ = this.rdToGlicko2(result.opponent.rd);
      const gPhiJ = this.g(phiJ);
      const eVal = this.E(mu, muJ, phiJ);
      newMu += newPhi * newPhi * gPhiJ * (result.score - eVal);
    }

    // Convert back to Glicko scale
    const newRating = this.toGlickoScale(newMu);
    const newRd = this.rdToGlicko(newPhi);

    return {
      newRating: Math.round(newRating * 10) / 10,
      newRd: Math.round(Math.min(newRd, this.DEFAULT_RD) * 10) / 10,
      newVolatility: newSigma,
      ratingChange: Math.round((newRating - player.rating) * 10) / 10,
    };
  }

  /**
   * Step 4: Calculate new volatility using Illinois algorithm
   */
  private calculateNewVolatility(
    phi: number,
    sigma: number,
    v: number,
    delta: number
  ): number {
    const a = Math.log(sigma * sigma);
    const tau2 = this.TAU * this.TAU;
    
    const f = (x: number): number => {
      const ex = Math.exp(x);
      const phi2 = phi * phi;
      const num1 = ex * (delta * delta - phi2 - v - ex);
      const den1 = 2 * (phi2 + v + ex) * (phi2 + v + ex);
      return num1 / den1 - (x - a) / tau2;
    };

    // Set initial bounds
    let A = a;
    let B: number;

    if (delta * delta > phi * phi + v) {
      B = Math.log(delta * delta - phi * phi - v);
    } else {
      let k = 1;
      while (f(a - k * this.TAU) < 0) {
        k++;
      }
      B = a - k * this.TAU;
    }

    // Illinois algorithm
    let fA = f(A);
    let fB = f(B);

    while (Math.abs(B - A) > this.CONVERGENCE_TOLERANCE) {
      const C = A + (A - B) * fA / (fB - fA);
      const fC = f(C);

      if (fC * fB <= 0) {
        A = B;
        fA = fB;
      } else {
        fA = fA / 2;
      }

      B = C;
      fB = fC;
    }

    return Math.exp(A / 2);
  }

  /**
   * Calculate team match result
   * Takes two teams and returns rating changes for all players
   */
  calculateTeamMatch(
    radiantTeam: GlickoPlayer[],
    direTeam: GlickoPlayer[],
    radiantWin: boolean
  ): Map<number, RatingChange> {
    const changes = new Map<number, RatingChange>();

    // Calculate average opponent rating for each team
    const radiantAvg = this.getTeamAverage(radiantTeam);
    const direAvg = this.getTeamAverage(direTeam);

    // Process each Radiant player
    for (let i = 0; i < radiantTeam.length; i++) {
      const player = radiantTeam[i];
      const result: GlickoResult = {
        opponent: direAvg,
        score: radiantWin ? 1 : 0,
      };
      changes.set(i, this.calculateNewRating(player, [result]));
    }

    // Process each Dire player
    for (let i = 0; i < direTeam.length; i++) {
      const player = direTeam[i];
      const result: GlickoResult = {
        opponent: radiantAvg,
        score: radiantWin ? 0 : 1,
      };
      changes.set(i + 5, this.calculateNewRating(player, [result]));
    }

    return changes;
  }

  /**
   * Get team average as a single "opponent" for rating calculation
   */
  private getTeamAverage(team: GlickoPlayer[]): GlickoPlayer {
    const avgRating = team.reduce((sum, p) => sum + p.rating, 0) / team.length;
    const avgRd = team.reduce((sum, p) => sum + p.rd, 0) / team.length;
    const avgVol = team.reduce((sum, p) => sum + p.volatility, 0) / team.length;

    return {
      rating: avgRating,
      rd: avgRd,
      volatility: avgVol,
    };
  }

  /**
   * Calculate expected win probability for team A vs team B
   */
  calculateWinProbability(teamA: GlickoPlayer[], teamB: GlickoPlayer[]): number {
    const avgA = this.getTeamAverage(teamA);
    const avgB = this.getTeamAverage(teamB);

    const muA = this.toGlicko2Scale(avgA.rating);
    const muB = this.toGlicko2Scale(avgB.rating);
    const phiB = this.rdToGlicko2(avgB.rd);

    return this.E(muA, muB, phiB);
  }

  /**
   * Get minimum games needed for rating to be "established" (low RD)
   */
  getConfidenceLevel(rd: number): 'provisional' | 'established' | 'certain' {
    if (rd >= 200) return 'provisional';
    if (rd >= 100) return 'established';
    return 'certain';
  }
}

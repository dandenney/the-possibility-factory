/** Bets to pin at the top of the picker. `bet` uses ESPN team abbreviations. */
export interface FeaturedBet {
  event: string;
  bet: string;
  odds: string;
  matchup: string;
}

export const featured: FeaturedBet[] = [
  { event: "401858502", bet: "IOWA ML", odds: "-135", matchup: "Wisconsin @ Iowa" },
  { event: "401858504", bet: "WASH +7.5", odds: "-115", matchup: "Washington @ Nebraska" },
];

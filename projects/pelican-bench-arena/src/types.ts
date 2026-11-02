export interface ModelConfig {
  slug: string;
  id: string;
  name: string;
  lab: string;
  featured: boolean;
  link?: string;
  maxTokens?: number;
}

export interface ArenaConfig {
  prompt: string;
  samplesPerModel: number;
  maxTokens: number;
  models: ModelConfig[];
}

export interface Sample {
  id: string;
  model: string;
  file: string;
  outputTokens: number | null;
  cost: number | null;
  seconds: number;
  createdAt: string;
}

export interface Failure {
  model: string;
  attempt: number;
  reason: string;
  createdAt: string;
}

export interface Gallery {
  generatedAt: string | null;
  samples: Sample[];
  failures: Failure[];
}

export type Outcome = "a" | "b" | "tie";

export interface Vote {
  a: string;
  b: string;
  outcome: Outcome;
}

export interface Standing {
  model: string;
  score: number;
  wins: number;
  losses: number;
  ties: number;
  votes: number;
}

import type { EntryType } from '@typesafe-ai/sdk';

export interface CascadeOptions<TChoice extends string> {
  instructions: string;
  criteria: Record<TChoice, string>;
  minConfidence?: number; // Default: 0.80
  timeoutMs?: number;     // Default: 2500ms
  system1?: System1Provider<TChoice>;
  system2: System2Provider<TChoice>;
}

export interface CascadeResult<TChoice extends string> {
  choice: TChoice;
  resolvedBy: 'system-1' | 'system-2';
  confidence: number;
  latencyMs: number;
  system1Details?: {
    probabilities: Record<string, number>;
    rawChoice: string;
  };
  system2Details?: {
    reasoning?: string;
  };
}

export type System1Provider<TChoice extends string> = (
  state: EntryType,
  instructions: string,
  criteria: Record<TChoice, string>,
  signal: AbortSignal
) => Promise<{
  choice: TChoice;
  confidence: number;
  probabilities: Record<string, number>;
}>;

export type System2Provider<TChoice extends string> = (
  state: EntryType,
  context: {
    instructions: string;
    criteria: Record<TChoice, string>;
    system1Attempt?: {
      choice: TChoice;
      confidence: number;
      probabilities: Record<string, number>;
    };
    reason: 'low-confidence' | 'system1-error' | 'timeout';
  }
) => Promise<{
  choice: TChoice;
  reasoning?: string;
}>;

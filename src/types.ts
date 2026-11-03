import type { EntryType } from "@typesafe-ai/sdk";

export type CascadeState = NonNullable<EntryType>;

export interface CascadeOptions<TChoice extends string> {
  instructions: string;
  criteria: Record<TChoice, string>;
  /** Minimum System 1 confidence, from 0 to 1, to skip System 2. Default 0.8. */
  minConfidence?: number;
  /** Deadline for System 1 before escalating. Default 2500ms. */
  timeoutMs?: number;
  /** Defaults to Jev via `createTypeSafeSystem1()`, which reads `TYPESAFE_API_KEY`. */
  system1?: System1Provider<TChoice>;
  system2: System2Provider<TChoice>;
}

export interface System1Result<TChoice extends string> {
  choice: TChoice;
  confidence: number;
  probabilities: Record<TChoice, number>;
}

export type EscalationReason = "low-confidence" | "system1-error" | "timeout";

export interface CascadeResult<TChoice extends string> {
  choice: TChoice;
  resolvedBy: "system-1" | "system-2";
  /** System 1's confidence; 0 when System 1 timed out or failed. */
  confidence: number;
  latencyMs: number;
  escalationReason?: EscalationReason;
  system1Details?: {
    probabilities: Record<TChoice, number>;
    rawChoice: TChoice;
  };
  system2Details?: {
    reasoning?: string;
  };
}

export type System1Provider<TChoice extends string> = (
  state: CascadeState,
  instructions: string,
  criteria: Record<TChoice, string>,
  signal: AbortSignal,
) => Promise<System1Result<TChoice>>;

export type System2Provider<TChoice extends string> = (
  state: CascadeState,
  context: {
    instructions: string;
    criteria: Record<TChoice, string>;
    system1Attempt?: System1Result<TChoice>;
    reason: EscalationReason;
  },
) => Promise<{
  choice: TChoice;
  reasoning?: string;
}>;

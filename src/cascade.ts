import { TypeSafeClient } from "@typesafe-ai/sdk";
import type {
  CascadeOptions,
  CascadeResult,
  CascadeState,
  EscalationReason,
  System1Provider,
  System1Result,
  System2Provider,
} from "./types";

export class System1TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`System 1 exceeded ${timeoutMs}ms`);
    this.name = "System1TimeoutError";
  }
}

export class CascadeClassifier<TChoice extends string> {
  private readonly instructions: string;
  private readonly criteria: Record<TChoice, string>;
  private readonly minConfidence: number;
  private readonly timeoutMs: number;
  private readonly system1: System1Provider<TChoice>;
  private readonly system2: System2Provider<TChoice>;

  constructor(options: CascadeOptions<TChoice>) {
    this.instructions = options.instructions;
    this.criteria = options.criteria;
    this.minConfidence = options.minConfidence ?? 0.8;
    this.timeoutMs = options.timeoutMs ?? 2500;
    this.system2 = options.system2;

    if (!(this.minConfidence >= 0 && this.minConfidence <= 1)) {
      throw new RangeError(
        `minConfidence must be between 0 and 1, got ${this.minConfidence}`,
      );
    }
    if (!(this.timeoutMs > 0)) {
      throw new RangeError(`timeoutMs must be positive, got ${this.timeoutMs}`);
    }
    if (Object.keys(this.criteria).length === 0) {
      throw new RangeError("criteria needs at least one label");
    }
    this.system1 = options.system1 ?? createTypeSafeSystem1<TChoice>();
  }

  async classify(state: CascadeState): Promise<CascadeResult<TChoice>> {
    const start = performance.now();

    let attempt: System1Result<TChoice>;
    try {
      attempt = await this.runSystem1(state);
    } catch (err) {
      const reason =
        err instanceof System1TimeoutError ? "timeout" : "system1-error";
      const s2 = await this.runSystem2(state, reason);
      return {
        choice: s2.choice,
        resolvedBy: "system-2",
        confidence: 0,
        latencyMs: performance.now() - start,
        escalationReason: reason,
        system2Details: {
          reasoning:
            s2.reasoning ??
            `Escalated after System 1 ${reason === "timeout" ? "timeout" : "error"}`,
        },
      };
    }

    const system1Details = {
      rawChoice: attempt.choice,
      probabilities: attempt.probabilities,
    };
    if (attempt.confidence >= this.minConfidence) {
      return {
        choice: attempt.choice,
        resolvedBy: "system-1",
        confidence: attempt.confidence,
        latencyMs: performance.now() - start,
        system1Details,
      };
    }

    const s2 = await this.runSystem2(state, "low-confidence", attempt);
    return {
      choice: s2.choice,
      resolvedBy: "system-2",
      confidence: attempt.confidence,
      latencyMs: performance.now() - start,
      escalationReason: "low-confidence",
      system1Details,
      system2Details: { reasoning: s2.reasoning },
    };
  }

  private async runSystem1(
    state: CascadeState,
  ): Promise<System1Result<TChoice>> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err = new System1TimeoutError(this.timeoutMs);
        controller.abort(err);
        reject(err);
      }, this.timeoutMs);
    });

    try {
      const result = await Promise.race([
        this.system1(
          state,
          this.instructions,
          this.criteria,
          controller.signal,
        ),
        deadline,
      ]);
      if (!this.isLabel(result.choice)) {
        throw new Error(`System 1 returned unknown label "${result.choice}"`);
      }
      if (!(result.confidence >= 0 && result.confidence <= 1)) {
        throw new Error(
          `System 1 returned confidence ${result.confidence} outside 0..1`,
        );
      }
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  private async runSystem2(
    state: CascadeState,
    reason: EscalationReason,
    system1Attempt?: System1Result<TChoice>,
  ) {
    const result = await this.system2(state, {
      instructions: this.instructions,
      criteria: this.criteria,
      system1Attempt,
      reason,
    });
    if (!this.isLabel(result.choice)) {
      throw new Error(`System 2 returned unknown label "${result.choice}"`);
    }
    return result;
  }

  private isLabel(value: unknown): value is TChoice {
    return typeof value === "string" && Object.hasOwn(this.criteria, value);
  }
}

/**
 * Jev-backed System 1. Model and base URL fall back to the SDK defaults
 * (`TYPESAFE_DEFAULT_MODEL`, `TYPESAFE_BASE_URL`, then `jev-latest`).
 */
export function createTypeSafeSystem1<TChoice extends string>(
  apiKey = process.env.TYPESAFE_API_KEY,
  model?: string,
): System1Provider<TChoice> {
  if (!apiKey) {
    throw new Error(
      "TYPESAFE_API_KEY is not set. Pass an API key or a custom system1 provider.",
    );
  }

  // Retries are off because the cascade's deadline and System 2 are the retry path.
  const client = new TypeSafeClient({ apiKey, retry: { maxRetries: 0 } });

  return async (state, instructions, criteria, signal) => {
    const { answers } = await client.systemOne(
      {
        state,
        questions: { label: { type: "choice", instructions, criteria } },
        model,
      },
      { signal },
    );
    const { choice, confidence, probabilities } = answers.label;
    return { choice, confidence, probabilities: { ...probabilities } };
  };
}

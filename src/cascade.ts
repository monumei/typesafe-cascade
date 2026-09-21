import { TypeSafeClient, type EntryType } from '@typesafe-ai/sdk';
import type {
  CascadeOptions,
  CascadeResult,
  System1Provider,
  System2Provider
} from './types';

export class CascadeClassifier<TChoice extends string> {
  private instructions: string;
  private criteria: Record<TChoice, string>;
  private minConfidence: number;
  private timeoutMs: number;
  private system1: System1Provider<TChoice>;
  private system2: System2Provider<TChoice>;

  constructor(options: CascadeOptions<TChoice>) {
    this.instructions = options.instructions;
    this.criteria = options.criteria;
    this.minConfidence = options.minConfidence ?? 0.80;
    this.timeoutMs = options.timeoutMs ?? 2500;
    this.system1 = options.system1 ?? createTypeSafeSystem1<TChoice>();
    this.system2 = options.system2;
  }

  async classify(state: EntryType): Promise<CascadeResult<TChoice>> {
    const start = performance.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      // 1. Race System 1 against deadline
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('System 1 timeout'));
        }, this.timeoutMs);
      });

      const s1Result = await Promise.race([
        this.system1(state, this.instructions, this.criteria, controller.signal),
        timeoutPromise
      ]);

      clearTimeout(timer);

      // 2. High confidence threshold check
      if (s1Result.confidence >= this.minConfidence) {
        return {
          choice: s1Result.choice,
          resolvedBy: 'system-1',
          confidence: s1Result.confidence,
          latencyMs: performance.now() - start,
          system1Details: {
            rawChoice: s1Result.choice,
            probabilities: s1Result.probabilities
          }
        };
      }

      // 3. Low confidence: Escalate to System 2 with System 1 context
      const s2Result = await this.system2(state, {
        instructions: this.instructions,
        criteria: this.criteria,
        system1Attempt: s1Result,
        reason: 'low-confidence'
      });

      return {
        choice: s2Result.choice,
        resolvedBy: 'system-2',
        confidence: s1Result.confidence,
        latencyMs: performance.now() - start,
        system1Details: {
          rawChoice: s1Result.choice,
          probabilities: s1Result.probabilities
        },
        system2Details: {
          reasoning: s2Result.reasoning
        }
      };
    } catch (err: unknown) {
      if (timer) clearTimeout(timer);
      const isTimeout = controller.signal.aborted || (err instanceof Error && err.message.includes('timeout'));

      // 4. Graceful escalation on System 1 failure or timeout
      const s2Result = await this.system2(state, {
        instructions: this.instructions,
        criteria: this.criteria,
        reason: isTimeout ? 'timeout' : 'system1-error'
      });

      return {
        choice: s2Result.choice,
        resolvedBy: 'system-2',
        confidence: 0,
        latencyMs: performance.now() - start,
        system2Details: {
          reasoning: s2Result.reasoning ?? `Escalated due to System 1 ${isTimeout ? 'timeout' : 'error'}`
        }
      };
    }
  }
}

/**
 * Creates standard TypeSafe (Jev) System 1 provider.
 */
export function createTypeSafeSystem1<TChoice extends string>(
  apiKey?: string,
  model = 'jev-1.13.0'
): System1Provider<TChoice> {
  const resolvedKey = apiKey ?? process.env.TYPESAFE_API_KEY;
  if (!resolvedKey) {
    throw new Error('TYPESAFE_API_KEY is not set. Provide an API key or use a mock provider.');
  }

  const client = new TypeSafeClient({
    apiKey: resolvedKey,
    baseURL: 'https://api.typesafe.ai',
    defaultModel: model,
    retry: { maxRetries: 0 }
  });

  return async (state, instructions, criteria, signal) => {
    const questionKey = 'intent';
    const response = await client.systemOne({
      state,
      questions: {
        [questionKey]: {
          type: 'choice',
          instructions,
          criteria
        }
      },
      model
    }, { signal });

    const answer = response.answers[questionKey];
    if (!answer || answer.type !== 'choice') {
      throw new Error('Invalid choice response from TypeSafe System One');
    }

    return {
      choice: answer.choice as TChoice,
      confidence: answer.confidence,
      probabilities: answer.probabilities as Record<string, number>
    };
  };
}

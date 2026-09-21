import { describe, expect, it } from 'bun:test';
import { CascadeClassifier } from '../src/cascade';
import type { System1Provider, System2Provider } from '../src/types';

type Category = 'billing' | 'tech' | 'other';

const criteria: Record<Category, string> = {
  billing: 'Billing issues or invoice questions',
  tech: 'Technical issues or bugs',
  other: 'Other inquiries'
};

describe('CascadeClassifier', () => {
  it('resolves via System 1 when confidence meets threshold', async () => {
    const mockS1: System1Provider<Category> = async () => ({
      choice: 'billing',
      confidence: 0.95,
      probabilities: { billing: 0.95, tech: 0.03, other: 0.02 }
    });

    const mockS2: System2Provider<Category> = async () => ({
      choice: 'other',
      reasoning: 'Fallback'
    });

    const cascade = new CascadeClassifier<Category>({
      instructions: 'Classify tickets',
      criteria,
      minConfidence: 0.85,
      system1: mockS1,
      system2: mockS2
    });

    const result = await cascade.classify({ text: 'I want a refund' });

    expect(result.resolvedBy).toBe('system-1');
    expect(result.choice).toBe('billing');
    expect(result.confidence).toBe(0.95);
    expect(result.system1Details?.probabilities.billing).toBe(0.95);
  });

  it('escalates to System 2 when confidence is below threshold', async () => {
    const mockS1: System1Provider<Category> = async () => ({
      choice: 'billing',
      confidence: 0.60, // Below 0.85 threshold
      probabilities: { billing: 0.60, tech: 0.35, other: 0.05 }
    });

    const mockS2: System2Provider<Category> = async (_state, context) => {
      expect(context.reason).toBe('low-confidence');
      expect(context.system1Attempt?.confidence).toBe(0.60);
      return {
        choice: 'tech',
        reasoning: 'System 2 resolved ambiguity to tech issue'
      };
    };

    const cascade = new CascadeClassifier<Category>({
      instructions: 'Classify tickets',
      criteria,
      minConfidence: 0.85,
      system1: mockS1,
      system2: mockS2
    });

    const result = await cascade.classify({ text: 'Checkout failed with 500 error during payment' });

    expect(result.resolvedBy).toBe('system-2');
    expect(result.choice).toBe('tech');
    expect(result.system2Details?.reasoning).toBe('System 2 resolved ambiguity to tech issue');
  });

  it('escalates gracefully to System 2 when System 1 throws an error', async () => {
    const mockS1: System1Provider<Category> = async () => {
      throw new Error('TypeSafe API 500 Internal Error');
    };

    const mockS2: System2Provider<Category> = async (_state, context) => {
      expect(context.reason).toBe('system1-error');
      return {
        choice: 'other',
        reasoning: 'System 2 caught failure and assigned fallback queue'
      };
    };

    const cascade = new CascadeClassifier<Category>({
      instructions: 'Classify tickets',
      criteria,
      system1: mockS1,
      system2: mockS2
    });

    const result = await cascade.classify({ text: 'Random message' });

    expect(result.resolvedBy).toBe('system-2');
    expect(result.choice).toBe('other');
  });

  it('escalates to System 2 when System 1 exceeds timeoutMs', async () => {
    const mockS1: System1Provider<Category> = async (_state, _inst, _crit, signal) => {
      // Hang until aborted
      await new Promise((resolve) => {
        signal.addEventListener('abort', resolve);
      });
      return {
        choice: 'billing',
        confidence: 0.99,
        probabilities: { billing: 0.99, tech: 0.01, other: 0 }
      };
    };

    const mockS2: System2Provider<Category> = async (_state, context) => {
      expect(context.reason).toBe('timeout');
      return {
        choice: 'other',
        reasoning: 'Recovered from System 1 timeout'
      };
    };

    const cascade = new CascadeClassifier<Category>({
      instructions: 'Classify tickets',
      criteria,
      timeoutMs: 50, // Short 50ms timeout
      system1: mockS1,
      system2: mockS2
    });

    const result = await cascade.classify({ text: 'Lagging request' });

    expect(result.resolvedBy).toBe('system-2');
    expect(result.choice).toBe('other');
  });
});

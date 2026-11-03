import { describe, expect, it } from "bun:test";
import { CascadeClassifier } from "../src/cascade";
import type { System1Provider, System2Provider } from "../src/types";

type Category = "billing" | "tech" | "other";

const criteria: Record<Category, string> = {
  billing: "Billing issues or invoice questions",
  tech: "Technical issues or bugs",
  other: "Other inquiries",
};

describe("CascadeClassifier", () => {
  it("resolves via System 1 when confidence meets threshold", async () => {
    const mockS1: System1Provider<Category> = async () => ({
      choice: "billing",
      confidence: 0.95,
      probabilities: { billing: 0.95, tech: 0.03, other: 0.02 },
    });

    const mockS2: System2Provider<Category> = async () => ({
      choice: "other",
      reasoning: "Fallback",
    });

    const cascade = new CascadeClassifier<Category>({
      instructions: "Classify tickets",
      criteria,
      minConfidence: 0.85,
      system1: mockS1,
      system2: mockS2,
    });

    const result = await cascade.classify({ text: "I want a refund" });

    expect(result.resolvedBy).toBe("system-1");
    expect(result.choice).toBe("billing");
    expect(result.confidence).toBe(0.95);
    expect(result.system1Details?.probabilities.billing).toBe(0.95);
  });

  it("escalates to System 2 when confidence is below threshold", async () => {
    const mockS1: System1Provider<Category> = async () => ({
      choice: "billing",
      confidence: 0.6, // Below 0.85 threshold
      probabilities: { billing: 0.6, tech: 0.35, other: 0.05 },
    });

    const mockS2: System2Provider<Category> = async (_state, context) => {
      expect(context.reason).toBe("low-confidence");
      expect(context.system1Attempt?.confidence).toBe(0.6);
      return {
        choice: "tech",
        reasoning: "System 2 resolved ambiguity to tech issue",
      };
    };

    const cascade = new CascadeClassifier<Category>({
      instructions: "Classify tickets",
      criteria,
      minConfidence: 0.85,
      system1: mockS1,
      system2: mockS2,
    });

    const result = await cascade.classify({
      text: "Checkout failed with 500 error during payment",
    });

    expect(result.resolvedBy).toBe("system-2");
    expect(result.choice).toBe("tech");
    expect(result.system2Details?.reasoning).toBe(
      "System 2 resolved ambiguity to tech issue",
    );
  });

  it("escalates gracefully to System 2 when System 1 throws an error", async () => {
    const mockS1: System1Provider<Category> = async () => {
      throw new Error("TypeSafe API 500 Internal Error");
    };

    const mockS2: System2Provider<Category> = async (_state, context) => {
      expect(context.reason).toBe("system1-error");
      return {
        choice: "other",
        reasoning: "System 2 caught failure and assigned fallback queue",
      };
    };

    const cascade = new CascadeClassifier<Category>({
      instructions: "Classify tickets",
      criteria,
      system1: mockS1,
      system2: mockS2,
    });

    const result = await cascade.classify({ text: "Random message" });

    expect(result.resolvedBy).toBe("system-2");
    expect(result.choice).toBe("other");
  });

  it("escalates to System 2 when System 1 exceeds timeoutMs", async () => {
    const mockS1: System1Provider<Category> = async (
      _state,
      _inst,
      _crit,
      signal,
    ) => {
      // Hang until aborted
      await new Promise((resolve) => {
        signal.addEventListener("abort", resolve);
      });
      return {
        choice: "billing",
        confidence: 0.99,
        probabilities: { billing: 0.99, tech: 0.01, other: 0 },
      };
    };

    const mockS2: System2Provider<Category> = async (_state, context) => {
      expect(context.reason).toBe("timeout");
      return {
        choice: "other",
        reasoning: "Recovered from System 1 timeout",
      };
    };

    const cascade = new CascadeClassifier<Category>({
      instructions: "Classify tickets",
      criteria,
      timeoutMs: 50, // Short 50ms timeout
      system1: mockS1,
      system2: mockS2,
    });

    const result = await cascade.classify({ text: "Lagging request" });

    expect(result.resolvedBy).toBe("system-2");
    expect(result.choice).toBe("other");
  });
});

describe("CascadeClassifier edge cases", () => {
  const highS1: System1Provider<Category> = async () => ({
    choice: "billing",
    confidence: 0.95,
    probabilities: { billing: 0.95, tech: 0.03, other: 0.02 },
  });
  const lowS1: System1Provider<Category> = async () => ({
    choice: "billing",
    confidence: 0.4,
    probabilities: { billing: 0.4, tech: 0.35, other: 0.25 },
  });

  it("does not retry System 2 as a System 1 error when System 2 fails", async () => {
    let calls = 0;
    const failingS2: System2Provider<Category> = async () => {
      calls++;
      throw new Error("LLM down");
    };
    const cascade = new CascadeClassifier<Category>({
      instructions: "x",
      criteria,
      system1: lowS1,
      system2: failingS2,
    });

    await expect(cascade.classify("anything")).rejects.toThrow("LLM down");
    expect(calls).toBe(1);
  });

  it("treats a System 1 label outside the criteria as a System 1 error", async () => {
    const badS1 = (async () => ({
      choice: "shipping",
      confidence: 0.99,
      probabilities: { shipping: 0.99 },
    })) as unknown as System1Provider<Category>;
    let reason: string | undefined;
    const s2: System2Provider<Category> = async (_s, ctx) => {
      reason = ctx.reason;
      return { choice: "other" };
    };
    const cascade = new CascadeClassifier<Category>({
      instructions: "x",
      criteria,
      system1: badS1,
      system2: s2,
    });

    const result = await cascade.classify("anything");
    expect(result.resolvedBy).toBe("system-2");
    expect(reason).toBe("system1-error");
  });

  it("rejects a System 2 label outside the criteria", async () => {
    const badS2 = (async () => ({
      choice: "shipping",
    })) as unknown as System2Provider<Category>;
    const cascade = new CascadeClassifier<Category>({
      instructions: "x",
      criteria,
      system1: lowS1,
      system2: badS2,
    });

    await expect(cascade.classify("anything")).rejects.toThrow(/shipping/);
  });

  it("rejects a minConfidence outside 0..1", () => {
    expect(
      () =>
        new CascadeClassifier<Category>({
          instructions: "x",
          criteria,
          minConfidence: 85,
          system1: highS1,
          system2: async () => ({ choice: "other" }),
        }),
    ).toThrow(RangeError);
  });
});

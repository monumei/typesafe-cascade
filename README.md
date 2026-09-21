# TypeSafe Cascade (System 1 → System 2)

A production-grade TypeScript reference module demonstrating the **System 1 (Jev/TypeSafe) → System 2 (Reasoning LLM) Cascade Pattern**.

## Architectural Concept

```mermaid
flowchart TD
    Input[Incoming Request / State] --> S1[System 1: TypeSafe Jev]
    S1 --> Check{Confidence >= Threshold?}
    Check -- Yes --> FastOut[⚡ Fast Path: Return Typed Choice<br/>Latency: ~25ms | Cost: ~$0.0001]
    Check -- No / Timeout / Error --> S2[🧠 System 2: Reasoning LLM<br/>Claude / GPT / Human Queue]
    S2 --> DeepOut[Resolved with Context & Reasoning<br/>Latency: ~1.5s | Cost: ~$0.01]
```

- **System 1 (Jev)** handles 70–80% of routine requests with calibrated probabilities in milliseconds.
- **System 2 (Reasoning LLM)** is only invoked when confidence drops below the threshold, saving 70%+ in LLM API spend and latency.

## Project Structure

- [`src/types.ts`](./src/types.ts): Typed contracts for choices, options, and resolution telemetry.
- [`src/cascade.ts`](./src/cascade.ts): Reusable `CascadeClassifier<TChoice>` with automatic timeout race and failure fallback.
- [`src/demo.ts`](./src/demo.ts): Runnable customer support ticket triage demo with realistic fast-path vs ambiguous edge cases.
- [`test/cascade.test.ts`](./test/cascade.test.ts): Unit tests covering high confidence, low confidence, timeout, and API error escalation.

## Quick Start

```bash
cd ~/Coding/typesafe-cascade

# Run tests
bun test

# Run demo
bun start

# Typecheck
bun run typecheck
```

To run against live TypeSafe servers:
```bash
export TYPESAFE_API_KEY="your-key"
bun start
```

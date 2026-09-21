import { CascadeClassifier, createTypeSafeSystem1 } from './cascade';
import type { System1Provider, System2Provider } from './types';

type SupportCategory = 'refund_request' | 'account_security' | 'bug_report' | 'general_inquiry';

const categories: Record<SupportCategory, string> = {
  refund_request: 'User wants money back, billing adjustment, or cancelled charge refunded',
  account_security: 'Unauthorized access, hacked account, compromised credentials, or suspicious logins',
  bug_report: 'Software defects, crashes, broken UI features, error messages, or unexpected technical behavior',
  general_inquiry: 'General product questions, polite feedback, praise, or general informational inquiries'
};

// Simulated System 2 (Reasoning LLM / Fallback Handler)
const reasoningLLMSystem2: System2Provider<SupportCategory> = async (state, context) => {
  // Simulate reasoning step latency (e.g. Claude 3.5 Sonnet / GPT-4o)
  await Bun.sleep(120);

  const message = (typeof state === 'object' && state !== null && 'message' in state)
    ? String(state.message ?? '')
    : '';
  const text = message.toLowerCase();
  
  if (text.includes('crash') && (text.includes('charge') || text.includes('payment'))) {
    return {
      choice: 'bug_report',
      reasoning: 'User mentions both a crash and a payment charge. The root cause is an app crash interrupting checkout; route to Engineering triage first while verifying transaction status.'
    };
  }

  return {
    choice: context.system1Attempt?.choice ?? 'general_inquiry',
    reasoning: 'System 2 resolved ambiguity based on full conversation context analysis.'
  };
};

// Fallback simulated System 1 when no live API key is provided
const simulatedSystem1: System1Provider<SupportCategory> = async (state) => {
  await Bun.sleep(25); // Fast ~25ms inference simulation
  const message = (typeof state === 'object' && state !== null && 'message' in state)
    ? String(state.message ?? '')
    : '';
  const text = message.toLowerCase();

  // Clear-cut cases -> High confidence (0.92 - 0.98)
  if (text.includes('unauthorized') || text.includes('hacked') || text.includes('password')) {
    return {
      choice: 'account_security',
      confidence: 0.96,
      probabilities: { account_security: 0.96, bug_report: 0.02, refund_request: 0.01, general_inquiry: 0.01 }
    };
  }

  if (text.includes('refund') && text.includes('cancel')) {
    return {
      choice: 'refund_request',
      confidence: 0.94,
      probabilities: { refund_request: 0.94, general_inquiry: 0.03, bug_report: 0.02, account_security: 0.01 }
    };
  }

  // Ambiguous multi-intent case -> Low confidence (e.g. 0.58)
  if (text.includes('crash') && (text.includes('charge') || text.includes('payment'))) {
    return {
      choice: 'refund_request',
      confidence: 0.58,
      probabilities: { refund_request: 0.58, bug_report: 0.38, account_security: 0.02, general_inquiry: 0.02 }
    };
  }

  return {
    choice: 'general_inquiry',
    confidence: 0.88,
    probabilities: { general_inquiry: 0.88, bug_report: 0.06, refund_request: 0.04, account_security: 0.02 }
  };
};

async function runDemo() {
  const hasLiveApiKey = Boolean(process.env.TYPESAFE_API_KEY);
  console.log(`\n=== TypeSafe Cascade Pattern Demo ===`);
  console.log(`Mode: ${hasLiveApiKey ? 'Live Jev (api.typesafe.ai)' : 'Local Simulated System 1 (Set TYPESAFE_API_KEY for live)'}\n`);

  const classifier = new CascadeClassifier<SupportCategory>({
    instructions: 'Classify incoming customer support tickets into the correct operational queue.',
    criteria: categories,
    minConfidence: 0.85,
    system1: hasLiveApiKey ? createTypeSafeSystem1() : simulatedSystem1,
    system2: reasoningLLMSystem2
  });

  const testTickets = [
    {
      id: 'TICKET-101',
      title: 'Clear Security Breach',
      message: 'Someone just logged into my account from Russia and changed my password! HELP!'
    },
    {
      id: 'TICKET-102',
      title: 'Clear Refund Request',
      message: 'Please cancel my annual subscription and issue a full refund for yesterday charge.'
    },
    {
      id: 'TICKET-103',
      title: 'Ambiguous Edge Case (Crash during payment)',
      message: 'The app crashed right when I tapped submit payment. Did you charge me or is this a bug??'
    },
    {
      id: 'TICKET-104',
      title: 'Casual Feedback',
      message: 'Loving the new interface, the dark mode palette looks fantastic.'
    }
  ];

  for (const ticket of testTickets) {
    console.log(`----------------------------------------------------------------`);
    console.log(`[${ticket.id}] "${ticket.title}"`);
    console.log(`Message: "${ticket.message}"`);

    const result = await classifier.classify({ message: ticket.message });

    if (result.resolvedBy === 'system-1') {
      console.log(`⚡ RESOLVED BY SYSTEM 1 (Fast Path)`);
      console.log(`   Queue:      ${result.choice}`);
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   Latency:    ${result.latencyMs.toFixed(1)}ms`);
    } else {
      console.log(`🧠 ESCALATED TO SYSTEM 2 (Reasoning Path)`);
      console.log(`   Queue:      ${result.choice}`);
      console.log(`   S1 Conf:    ${(result.confidence * 100).toFixed(1)}% (below 85% threshold)`);
      console.log(`   Latency:    ${result.latencyMs.toFixed(1)}ms`);
      if (result.system2Details?.reasoning) {
        console.log(`   Reasoning:  "${result.system2Details.reasoning}"`);
      }
    }
  }

  console.log(`----------------------------------------------------------------\n`);
}

runDemo().catch(console.error);

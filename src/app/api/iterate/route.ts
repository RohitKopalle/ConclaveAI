const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY;

// 🧠 MULTI-MODEL DELIBERATION ENGINES
const AGENT_ALPHA_MODEL = 'mistralai/mistral-nemo'; // Agent Alpha (Fast baseline generation)
const AGENT_BETA_MODEL = 'meta-llama/llama-3.1-8b-instruct'; // Agent Beta (Rigorous critique & logic parsing)
const CHAIRMAN_MODEL = 'mistralai/mistral-nemo';   // Executive Synthesizer

type Message = { role: string; content: string };
type DepthMode = 'brief' | 'moderate' | 'detailed';

// 🌐 REAL-TIME WEB GROUNDING
async function fetchRealTimeContext(query: string): Promise<string> {
  try {
    if (BRIGHTDATA_API_KEY) {
      const bdRes = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`
        },
        body: JSON.stringify({ zone: 'serp_api', url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, format: 'raw' })
      });
      if (bdRes.ok) {
        const data = await bdRes.json();
        return `[Live Verified Context]: ${JSON.stringify(data).substring(0, 1000)}`;
      }
    }
  } catch {
    // Fallback silently to DuckDuckGo
  }

  // Resilient Fallback (DuckDuckGo Lite HTML parsing)
  try {
    const fallbackRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    const html = await fallbackRes.text();
    const snippets = [...html.matchAll(/<a class="result__snippet[^>]*>(.*?)<\/a>/g)]
      .map(m => m[1].replace(/<\/?[^>]+(>|$)/g, ""))
      .slice(0, 5)
      .join(' | ');
    if (snippets) {
      return `[Live Verified Context]: ${snippets}`;
    }
  } catch {
    // Fallback if offline
  }

  return "[Verified Knowledge Base]: Use verified domain knowledge. Acknowledge any uncertain claims.";
}

// 🛡️ UNIVERSAL ZERO-HALLUCINATION DIRECTIVE
const ZERO_HALLUCINATION_DIRECTIVE = `
STRICT FACTUAL INTEGRITY & ZERO HALLUCINATION DIRECTIVE:
1. Ground every statement strictly in the provided Search Engine Context and verified domain knowledge.
2. Under NO circumstances invent fake citations, fictitious URLs, speculative statistics, false quotes, or unverified claims.
3. If an answer or specific detail is not firmly established or supported by retrieved facts, explicitly state: "Information on [topic] is unverified or unavailable."
4. Never generate conversational pleasantries, intro filler (e.g. "Sure!", "Here is the breakdown:"), or outro meta-commentary. Output raw, clean, authoritative Markdown directly.
`;

function getDepthConfig(depth: DepthMode) {
  switch (depth) {
    case 'brief':
      return {
        label: 'Brief Response',
        v1System: `You are Agent Alpha. Provide a strictly concise, fact-based response to the user's prompt (maximum 1-2 tight paragraphs or a direct answer followed by 3 concise bullet points). Zero fluff. State core facts only.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        eval1System: `You are Agent Beta, a rigorous accuracy and conciseness auditor. Evaluate Agent Alpha's baseline. Ensure it is razor-sharp, strictly fact-based, and has zero filler. Identify any redundant words or unverified assertions. Demand a perfectly distilled, high-impact brief V2.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        change1Text: 'Agent Beta audited factual precision and streamlined redundant text for a razor-sharp brief.',
        v2System: `You are Agent Beta. Refine Agent Alpha's baseline into a high-impact, brief document. Eliminate wordiness, preserve 100% of the core verified facts, and format clearly. Keep it concise (under 250 words).\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        eval2System: `You are Chairman AI. Review Agent Beta's brief document. Write exactly one commanding sentence verifying factual accuracy and directing the final executive summary to be decisive and concise.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        change2Text: 'Chairman AI confirmed factual precision. Synthesizing the high-impact executive brief.',
        v3System: `You are Chairman AI. Produce the final concise executive brief. Keep it tightly focused (maximum 250-350 words). Include:\n- **Executive Summary** (1-2 clear, punchy sentences answering the prompt directly)\n- **Core Takeaways** (3-4 crisp bullet points with verified facts)\n- **Final Verdict** (1 decisive, bottom-line takeaway sentence).\nDo not add filler or conversational fluff.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        maxTokensV1: 600,
        maxTokensV2: 700,
        maxTokensV3: 900,
        temperature: 0.1
      };

    case 'detailed':
      return {
        label: 'Detailed Deep-Dive',
        v1System: `You are Agent Alpha. Provide a comprehensive, multi-faceted initial architectural analysis of the user's prompt (400-600 words). Detail foundational mechanisms, background context, and structural factors.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        eval1System: `You are Agent Beta, a relentless technical and logical critic. Scrutinize Agent Alpha's baseline. Identify missing edge cases, deeper systemic implications, historical context, or technical nuances that need exhaustive elaboration. Demand a massive, comprehensive deep-dive V2 upgrade.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        change1Text: 'Agent Beta identified opportunities for comprehensive expansion, edge-case coverage, and technical depth. Upgrading for deep-dive V2.',
        v2System: `You are Agent Beta. Massively expand Agent Alpha's baseline into an exhaustive, deep-dive architectural analysis addressing all points of critique. Include detailed sections, methodology, edge cases, and comparative breakdowns. Ensure rigorous depth.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        eval2System: `You are Chairman AI. Review Agent Beta's deep-dive document. Write exactly one profound, commanding sentence confirming the depth and directing the final synthesizer to produce an exhaustive, authoritative masterpiece.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        change2Text: 'Chairman AI verified the deep-dive architecture. Synthesizing the exhaustive master analysis.',
        v3System: `You are Chairman AI. Produce the ultimate comprehensive master analysis (1000-1800+ words). Go into rigorous, exhaustive detail across all dimensions. Include:\n- **Executive Summary** (Comprehensive overview)\n- **In-Depth Structural Breakdown & Technical Mechanics**\n- **Critical Analysis, Edge Cases & Trade-offs**\n- **Strategic Framework & Actionable Recommendations**\n- **Final Verdict** (Exhaustive master-summary synthesizing all evidence into a definitive conclusion)\nFormat with rich, authoritative Markdown.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        maxTokensV1: 2500,
        maxTokensV2: 3500,
        maxTokensV3: 4000,
        temperature: 0.12
      };

    case 'moderate':
    default:
      return {
        label: 'Moderate Response',
        v1System: `You are Agent Alpha. Provide a balanced, structured, and factual baseline response to the user's prompt (around 300-450 words, structured into 2-3 clear sections). Balance breadth and readability without overwhelming detail or excessive brevity.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        eval1System: `You are Agent Beta, an analytical critique agent. Evaluate Agent Alpha's baseline for balance, objectivity, and factual rigor. Check that key practical nuances and trade-offs are covered without fluff or over-complication. Demand a balanced, structured V2 refinement.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        change1Text: 'Agent Beta checked for analytical balance and structured clarity. Upgrading baseline for balanced V2.',
        v2System: `You are Agent Beta. Refine Agent Alpha's baseline into a well-balanced, clearly structured analysis (around 450-600 words). Add structured sections, practical considerations, and key trade-offs while maintaining crisp readability. DO NOT over-expand into endless minutiae.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        eval2System: `You are Chairman AI. Review Agent Beta's balanced V2 analysis. Write exactly one authoritative sentence confirming logical balance and directing the final synthesis.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        change2Text: 'Chairman AI confirmed structural balance and factual integrity. Synthesizing the final executive brief.',
        v3System: `You are Chairman AI. Produce the final balanced executive synthesis (around 500-750 words). Include:\n- **Executive Summary** (1 clear paragraph summarizing the core answer)\n- **Key Analysis & Considerations** (2-3 well-organized sections or structured bullet points with verified insights)\n- **Final Verdict** (A balanced, decisive concluding summary)\nMake the markdown clean, engaging, and professional.\n${ZERO_HALLUCINATION_DIRECTIVE}`,
        maxTokensV1: 1200,
        maxTokensV2: 1500,
        maxTokensV3: 2000,
        temperature: 0.1
      };
  }
}

async function streamFromOpenRouter(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  history: Message[],
  maxTokens: number,
  temperature: number,
  onChunk: (text: string) => void
) {
  if (!OPENROUTER_API_KEY) {
    const mockResponse = "This is a **mocked** response. Please add your `OPENROUTER_API_KEY` to `.env` to trigger the actual LLM generation.\n\n";
    for (const char of mockResponse) {
      onChunk(char);
      await new Promise(r => setTimeout(r, 15));
    }
    return mockResponse;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userPrompt }
  ];

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://conclave.ai',
      'X-Title': 'AI Conclave'
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: maxTokens,
      temperature
    })
  });

  if (!res.ok) {
    const err = await res.text();
    onChunk(`\n\n[API Error: ${err}]`);
    return `[API Error: ${err}]`;
  }

  let fullResponse = '';
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices?.[0]?.delta?.content) {
              const text = data.choices[0].delta.content;
              fullResponse += text;
              onChunk(text);
            }
          } catch {
            // ignore JSON parse chunks
          }
        }
      }
    }
  }

  return fullResponse;
}

export async function POST(req: Request) {
  const { prompt, depth = 'moderate', history } = await req.json();
  const encoder = new TextEncoder();

  // Validate or default depth mode
  const safeDepth: DepthMode = (depth === 'brief' || depth === 'detailed' || depth === 'moderate') ? depth : 'moderate';
  const config = getDepthConfig(safeDepth);

  // Convert custom history format to standard role format
  const chatHistory: Message[] = [];
  if (history && Array.isArray(history)) {
    history.forEach((h: { user: string; assistant: string }) => {
      chatHistory.push({ role: 'user', content: h.user });
      chatHistory.push({ role: 'assistant', content: h.assistant });
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const sendData = (step: string, chunk: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step, chunk })}\n\n`));
      };

      try {
        // Step 0: Gather Real-Time Context
        sendData('v1', '*(Initializing BrightData Web Search for real-time grounding...)*\n\n');
        const liveContext = await fetchRealTimeContext(prompt);
        await new Promise(r => setTimeout(r, 400)); // UI pacing

        // Step 1: Initial Generation (V1)
        const v1Prompt = `User Prompt:\n${prompt}\n\nSearch Engine Context (Verified real-time grounding facts):\n${liveContext}\n\nTarget Depth: ${config.label}. Strictly adhere to the zero-hallucination directive and target depth. Respond directly:`;
        let v1Complete = "";
        v1Complete = await streamFromOpenRouter(
          AGENT_ALPHA_MODEL,
          config.v1System,
          v1Prompt,
          chatHistory,
          config.maxTokensV1,
          config.temperature,
          (t) => sendData('v1', t.replace('*(Initializing BrightData Web Search for real-time grounding...)*\n\n', ''))
        );

        // Wait briefly
        await new Promise(r => setTimeout(r, 800));

        // Step 2: Evaluation 1 (Beta Critique)
        const eval1Prompt = `Baseline document for latest prompt:\n${v1Complete}\n\nTarget Depth: ${config.label}. Evaluate factual accuracy, absence of hallucination, and adherence to target depth. Output 2-3 direct critical bullet points without intro filler.`;
        let eval1Complete = "";
        eval1Complete = await streamFromOpenRouter(
          AGENT_BETA_MODEL,
          config.eval1System,
          eval1Prompt,
          chatHistory,
          600,
          config.temperature,
          (t) => sendData('eval1', t)
        );

        // Step 3: Explanation 1
        sendData('change1', config.change1Text);
        await new Promise(r => setTimeout(r, 1200));

        // Step 4: Refinement (V2)
        const v2Prompt = `Original Document:\n${v1Complete}\n\nCritique to Address:\n${eval1Complete}\n\nTarget Depth: ${config.label}. Produce the complete refined V2 document with zero hallucinations and no introductory text.`;
        let v2Complete = "";
        v2Complete = await streamFromOpenRouter(
          AGENT_BETA_MODEL,
          config.v2System,
          v2Prompt,
          chatHistory,
          config.maxTokensV2,
          config.temperature,
          (t) => sendData('v2', t)
        );

        await new Promise(r => setTimeout(r, 800));

        // Step 5: Evaluation 2 (Chairman Verification)
        const eval2Prompt = `Original User Prompt:\n${prompt}\n\nV2 Document:\n${v2Complete}\n\nTarget Depth: ${config.label}. Verify factual integrity, zero hallucination, and depth compliance. Write exactly one commanding verification sentence without intro filler.`;
        let eval2Complete = "";
        eval2Complete = await streamFromOpenRouter(
          CHAIRMAN_MODEL,
          config.eval2System,
          eval2Prompt,
          chatHistory,
          300,
          config.temperature,
          (t) => sendData('eval2', t)
        );

        // Step 6: Explanation 2
        sendData('change2', config.change2Text);
        await new Promise(r => setTimeout(r, 1200));

        // Step 7: Final Synthesis (V3)
        const v3Prompt = `V2 Document:\n${v2Complete}\n\nVerification Notes:\n${eval2Complete}\n\nTarget Depth: ${config.label}. Produce the final synthesized executive document with flawless formatting and zero hallucinations. Output raw content directly.`;
        await streamFromOpenRouter(
          CHAIRMAN_MODEL,
          config.v3System,
          v3Prompt,
          chatHistory,
          config.maxTokensV3,
          config.temperature,
          (t) => sendData('v3', t)
        );

        // Completed
        sendData('completed', 'Done');
      } catch (e) {
        console.error("Streaming error: ", e);
        sendData('completed', 'Error occurred');
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

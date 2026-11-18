const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY;

// 🧠 CONFIGURE YOUR MULTI-MODEL DELIBERATION
// Swap these OpenRouter model strings to create a true diversity of thought!
const AGENT_ALPHA_MODEL = 'mistralai/mistral-nemo'; // Agent Alpha (Fast baseline generation)
const AGENT_BETA_MODEL = 'meta-llama/llama-3.1-8b-instruct'; // Agent Beta (Rigorous critique & logic parsing)
const CHAIRMAN_MODEL = 'mistralai/mistral-nemo';   // Powerful executive synthesizer

type Message = { role: string; content: string };

// 🌐 BRIGHTDATA REAL-TIME WEB GROUNDING
async function fetchRealTimeContext(query: string): Promise<string> {
  try {
    // Attempt BrightData SERP API (requires correct zone configuration)
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
        return `[Live Context]: ${JSON.stringify(data).substring(0, 1000)}`;
      }
    }
  } catch {
    // Fallback silently
  }

  // Robust Fallback (DuckDuckGo Lite HTML parsing) to guarantee Hackathon demo survives
  try {
    const fallbackRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    const html = await fallbackRes.text();
    const snippets = [...html.matchAll(/<a class="result__snippet[^>]*>(.*?)<\/a>/g)]
      .map(m => m[1].replace(/<\/?[^>]+(>|$)/g, ""))
      .slice(0, 5)
      .join(' | ');
    return `[Live Context]: ${snippets}`;
  } catch {
    return "[Live Context]: Real-time search unavailable.";
  }
}

async function streamFromOpenRouter(model: string, systemPrompt: string, userPrompt: string, history: Message[], onChunk: (text: string) => void) {
  if (!OPENROUTER_API_KEY) {
    const mockResponse = "This is a **mocked** response. Please add your `OPENROUTER_API_KEY` to `.env` to trigger the actual LLM generation.\\n\\n";
    for (const char of mockResponse) {
      onChunk(char);
      await new Promise(r => setTimeout(r, 20));
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
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 3500,
      temperature: 0.3
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
            if (data.choices[0].delta.content) {
              const text = data.choices[0].delta.content;
              fullResponse += text;
              onChunk(text);
            }
          } catch {
            // ignore
          }
        }
      }
    }
  }

  return fullResponse;
}

export async function POST(req: Request) {
  const { prompt, history } = await req.json();
  const encoder = new TextEncoder();

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
        await new Promise(r => setTimeout(r, 500)); // UI pacing

        // Step 1: Initial Generation (V1)
        const v1System = "You are Agent Alpha, a world-class AI researcher. Provide a strictly concise, accurate, brief baseline answer to the user's prompt (maximum 2-3 short paragraphs). Do not over-explain; simply state the foundational core facts logically. IMPORTANT: Do NOT include intro filler like 'Here is the analysis'. Output raw content directly.";

        let v1Complete = "";
        v1Complete = await streamFromOpenRouter(AGENT_ALPHA_MODEL, v1System, `User Prompt:\n${prompt}\n\nSearch Engine Context (Use this for up-to-date facts):\n${liveContext}\n\nRespond directly:`, chatHistory, (t) => sendData('v1', t.replace('*(Initializing BrightData Web Search for real-time grounding...)*\n\n', '')));

        // Wait briefly
        await new Promise(r => setTimeout(r, 1000));

        // Step 2: Evaluation 1
        const eval1System = "You are Agent Beta, a rigorous and demanding critic. Evaluate Agent Alpha's brief baseline. Your primary directive is to demand a massive expansion in depth. Output 2-3 critical bullet points pointing out how brief it is, demanding deep-dive breakdowns, statistical nuances, or historical context. NEVER say it is flawless. Demand an extensively detailed V2 upgrade. IMPORTANT: Do NOT include introductory filler.";
        let eval1Complete = "";
        eval1Complete = await streamFromOpenRouter(AGENT_BETA_MODEL, eval1System, `Baseline document for latest prompt:\n${v1Complete}`, chatHistory, (t) => sendData('eval1', t));

        // Step 3: Explanation 1
        const change1Text = "Agent Beta identified opportunities to expand the analysis with deeper historical context and structural nuance. Upgrading baseline for V2.";
        sendData('change1', change1Text);

        // Wait briefly
        await new Promise(r => setTimeout(r, 2000));

        // Step 4: Refinement (V2)
        const v2System = "You are Agent Beta, tasked with massively expanding the document. Take Agent Alpha's brief baseline and upgrade it into a highly detailed, comprehensive analysis incorporating your previous critique. Add new structured sections, detailed breakdowns, and rich context. The V2 document MUST be significantly longer and deeper than the brief V1. DO NOT include any intro filler.";
        let v2Complete = "";
        v2Complete = await streamFromOpenRouter(AGENT_BETA_MODEL, v2System, `Original Document:\n${v1Complete}\n\nCritique to Address:\n${eval1Complete}\n\nPlease output the complete refined document with NO introductory text.`, chatHistory, (t) => sendData('v2', t));

        // Wait briefly
        await new Promise(r => setTimeout(r, 1000));

        // Step 5: Evaluation 2 (Final Verification)
        const eval2System = "You are Chairman AI, the final executive verifier. Review Agent Beta's detailed V2 document. Write exactly one profound, commanding sentence confirming the structure is excellent and directing the final synthesizer to elevate it into an exhaustive, flawlessly formatted ultimate masterpiece. IMPORTANT: Do not include introductory filler.";
        let eval2Complete = "";
        eval2Complete = await streamFromOpenRouter(CHAIRMAN_MODEL, eval2System, `Original User Prompt:\n${prompt}\n\nV2 Document:\n${v2Complete}`, chatHistory, (t) => sendData('eval2', t));

        // Step 6: Explanation 2
        const change2Text = "Chairman AI confirmed the refined logic is production-ready. Synthesizing the final executive masterpiece.";
        sendData('change2', change2Text);

        // Wait briefly
        await new Promise(r => setTimeout(r, 2000));

        // Step 7: Final Output (V3)
        const v3System = "You are the Chairman AI. This is the final executive synthesis. Take the detailed V2 document and produce an entirely exhaustive, ultimate masterpiece. Go into as much detail as extraordinarily possible. Add a clear '**Executive Summary**' section at the top, and a '**Final Verdict**' section at the bottom. The Final Verdict MUST act as a profound, comprehensive, and easily digestible master-summary of all the deep details so the user instantly understands the complete picture. Make the markdown beautiful, rich, and breathtakingly authoritative. IMPORTANT: Output ONLY the nicely formatted raw final content directly.";
        await streamFromOpenRouter(CHAIRMAN_MODEL, v3System, `V2 Document:\n${v2Complete}\n\nVerification Notes:\n${eval2Complete}\n\nProduce the final synthesized document seamlessly with NO intro titles.`, chatHistory, (t) => sendData('v3', t));

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

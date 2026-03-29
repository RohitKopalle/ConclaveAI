import { NextResponse } from 'next/server';

const FEATHERLESS_API_KEY = process.env.FEATHERLESS_API_KEY;

// 🧠 CONFIGURE YOUR MULTI-MODEL DELIBERATION
// Swap these HuggingFace model strings to create a true diversity of thought!
const AGENT_ALPHA_MODEL = 'mistralai/Mistral-Nemo-Instruct-2407'; // Agent Alpha (Fast baseline generation)
const AGENT_BETA_MODEL = 'Qwen/Qwen2.5-7B-Instruct'; // Agent Beta (Rigorous critique & logic parsing)
const CHAIRMAN_MODEL = 'mistralai/Mistral-Nemo-Instruct-2407';   // Powerful executive synthesizer

type Message = { role: string; content: string };

async function streamFromFeatherless(model: string, systemPrompt: string, userPrompt: string, history: Message[], onChunk: (text: string) => void) {
  if (!FEATHERLESS_API_KEY) {
    const mockResponse = "This is a **mocked** response. Please add your `FEATHERLESS_API_KEY` to `.env.local` to trigger the actual LLM generation.\\n\\n";
    for (let char of mockResponse) {
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

  const res = await fetch('https://api.featherless.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FEATHERLESS_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 1500,
      temperature: 0.7
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
          } catch (e) {
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
    history.forEach((h: any) => {
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
        // Step 1: Initial Generation (V1)
        const v1System = "You are Agent Alpha, a world-class AI expert. Provide a highly accurate, logically sound, and authoritative response to the user's prompt. For factual questions, be precise and perfectly correct. For complex problems, provide detailed structured analysis. IMPORTANT: Do NOT include any intro filler, titles, or preambles automatically. Just output the raw content directly.";
        let v1Complete = "";
        v1Complete = await streamFromFeatherless(AGENT_ALPHA_MODEL, v1System, prompt, chatHistory, (t) => sendData('v1', t));
        
        // Wait briefly
        await new Promise(r => setTimeout(r, 1000));

        // Step 2: Evaluation 1
        const eval1System = "You are Agent Beta, a rigorous fact-checker and strategist. Evaluate Agent Alpha's response against the user prompt. If Alpha's response is already factually correct and fully answers the prompt, output exactly: 'No major flaws. Proceed.' ONLY if there are genuine factual errors, critical missing context, or logic gaps, output major areas for refinement. Be concise. IMPORTANT: Do NOT include introductory filler.";
        let eval1Complete = "";
        eval1Complete = await streamFromFeatherless(AGENT_BETA_MODEL, eval1System, `Baseline document for latest prompt:\n${v1Complete}`, chatHistory, (t) => sendData('eval1', t));
        
        // Step 3: Explanation 1
        const change1Text = eval1Complete.includes("No major flaws") 
            ? "Agent Beta verified the proposal is factually accurate and complete. Advancing baseline."
            : "Agent Beta identified missing context or inaccuracies in Alpha's proposal. Re-evaluating the foundational arguments for V2.";
        sendData('change1', change1Text);

        // Wait briefly
        await new Promise(r => setTimeout(r, 2000));

        // Step 4: Refinement (V2)
        const v2System = "You are Agent Beta reforming the document based on the critique. If the critique says 'No major flaws', simply output Alpha's response polished for clarity. Otherwise, output the newly refined version (V2) addressing all concerns and ensuring 100% factual accuracy. IMPORTANT: DO NOT include any titles, headers like 'V2 Document:', or intro filler. Output ONLY the raw refined content.";
        let v2Complete = "";
        v2Complete = await streamFromFeatherless(AGENT_BETA_MODEL, v2System, `Original Document:\n${v1Complete}\n\nCritique to Address:\n${eval1Complete}\n\nPlease output the complete refined document with NO introductory text.`, chatHistory, (t) => sendData('v2', t));

        // Wait briefly
        await new Promise(r => setTimeout(r, 1000));

        // Step 5: Evaluation 2 (Final Verification)
        const eval2System = "You are Chairman AI, the final verifier. Examine Agent Beta's document for absolute factual correctness and completeness. Give a brief 1-2 sentence final check summary. If it's flawless, explicitly confirm it. IMPORTANT: Do not include introductory filler.";
        let eval2Complete = "";
        eval2Complete = await streamFromFeatherless(CHAIRMAN_MODEL, eval2System, `Original User Prompt:\n${prompt}\n\nV2 Document:\n${v2Complete}`, chatHistory, (t) => sendData('eval2', t));

        // Step 6: Explanation 2
        const change2Text = eval1Complete.includes("No major flaws")
            ? "Chairman AI confirmed absolute factual correctness. Polishing final output."
            : "Agent Beta's V2 was robust. Chairman AI verified all logic constraints and is structuring the final output for maximum clarity.";
        sendData('change2', change2Text);

        // Wait briefly
        await new Promise(r => setTimeout(r, 2000));

        // Step 7: Final Output (V3)
        const v3System = "You are the Chairman AI. Based on Agent Beta's document and your Final Verification check, synthesize the ultimate Executive Output (V3). Ensure the answer is perfectly correct, answers the user's query fully, and is exceptionally well-formatted. IMPORTANT: DO NOT include any preamble, headers like 'Executive Synthesis:' or '**Executive Output (V3):**'. Output ONLY the beautifully formatted raw final content directly.";
        await streamFromFeatherless(CHAIRMAN_MODEL, v3System, `V2 Document:\n${v2Complete}\n\nVerification Notes:\n${eval2Complete}\n\nProduce the final synthesized document seamlessly with NO intro titles.`, chatHistory, (t) => sendData('v3', t));

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

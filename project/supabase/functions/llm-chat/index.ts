import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are JARVIS, a voice-controlled AI assistant. You are helpful, concise, and intelligent.

## Your Capabilities
You can perform actions by calling tools. Available tools:

**File Operations** (Browser File System Access API - user grants folder access)
- file.read: Read file contents
- file.write: Write or update a file
- file.search: Search for files by name or content
- file.list: List files in a directory
- file.delete: Delete a file (requires password approval)

**Task Management**
- task.create: Create a new task
- task.list: View all tasks
- task.complete: Mark a task as done
- task.delete: Remove a task

**Reminders**
- reminder.create: Set a reminder with time
- reminder.list: View all reminders
- reminder.delete: Remove a reminder

## How to Use Tools
When the user asks you to perform an action, respond with BOTH:
1. A natural language confirmation (so they hear/read your intent)
2. A tool call in this exact JSON format at the end of your message:

\`\`\`tool-call
{
  "tool": "tool.name",
  "args": {
    "arg1": "value1"
  }
}
\`\`\`

Example:
User: "Create a reminder for my 3pm meeting"
You: "I'll set a reminder for your 3pm meeting today.

\`\`\`tool-call
{
  "tool": "reminder.create",
  "args": {
    "text": "3pm meeting",
    "time": "2026-09-15T15:00:00Z"
  }
}
\`\`\`"

## Important Rules
- Always explain what you're about to do before calling the tool
- Use ISO 8601 format for times (YYYY-MM-DDTHH:mm:ssZ)
- File paths are relative to the user-granted directory
- Multiple tool calls: wrap each in its own \`\`\`tool-call block
- If you can't complete a request without more info, ask for clarification
- Keep responses conversational and concise`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { messages, sessionId } = body as { messages: { role: string; content: string }[]; sessionId?: string };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const groqKey = Deno.env.get("GROQ_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    let reply: string;

    if (groqKey) {
      reply = await callGroq(groqKey, messages);
    } else if (geminiKey) {
      reply = await callGemini(geminiKey, messages);
    } else {
      return new Response(
        JSON.stringify({ error: "No LLM API key configured. Set GROQ_API_KEY or GEMINI_API_KEY as an edge function secret." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse tool calls from reply
    const toolCalls = extractToolCalls(reply);

    // Store tool calls in database if any were found
    if (toolCalls.length > 0 && sessionId) {
      for (const tc of toolCalls) {
        const escalation = determineEscalation(tc.tool);
        await supabase.from('tool_calls').insert({
          session_id: sessionId,
          user_id: user.id,
          tool: tc.tool,
          args: tc.args,
          escalation_level: escalation,
          status: escalation === 'auto' ? 'approved' : 'pending',
        });
      }
    }

    return new Response(
      JSON.stringify({ reply, toolCalls }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function callGroq(
  apiKey: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned empty response");
  }
  return content;
}

async function callGemini(
  apiKey: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("Gemini returned empty response");
  }
  return content;
}

function extractToolCalls(reply: string): Array<{ tool: string; args: Record<string, any> }> {
  const toolCalls: Array<{ tool: string; args: Record<string, any> }> = [];
  const regex = /```tool-call\s*\n([\s\S]*?)\n```/g;
  let match;

  while ((match = regex.exec(reply)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool && parsed.args) {
        toolCalls.push({ tool: parsed.tool, args: parsed.args });
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  return toolCalls;
}

function determineEscalation(tool: string): 'auto' | 'confirm' | 'password' {
  // Auto-approve: read operations
  if (tool.includes('.read') || tool.includes('.list') || tool.includes('.search')) {
    return 'auto';
  }

  // Password required: destructive operations
  if (tool.includes('.delete') || tool === 'file.delete') {
    return 'password';
  }

  // Confirm: write operations
  return 'confirm';
}

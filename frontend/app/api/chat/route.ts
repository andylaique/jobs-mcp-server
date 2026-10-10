import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { executeTool, toolDefinitions } from "@/lib/tools";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions about a curated dataset of software job postings.
You have access to tools that search and count those postings.
Always use the tools when the user asks about jobs, skills, companies or specific postings.
Be concise and present results clearly (use bullet points or short tables when helpful).
If a tool returns an error, explain it politely to the user.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, apiKey } = body as {
      messages: { role: string; content: string }[];
      apiKey?: string;
    };

    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Gemini API key is required. Paste it in the UI or set GEMINI_API_KEY." },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(key);

    // Convert our tool defs to Gemini format
    const tools = [
      {
        functionDeclarations: toolDefinitions.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: {
            type: SchemaType.OBJECT,
            properties: Object.fromEntries(
              Object.entries(t.parameters.properties).map(([k, v]: [string, any]) => [
                k,
                {
                  type:
                    v.type === "integer"
                      ? SchemaType.INTEGER
                      : v.type === "boolean"
                        ? SchemaType.BOOLEAN
                        : SchemaType.STRING,
                  description: v.description,
                },
              ])
            ),
            required: t.parameters.required || [],
          },
        })),
      },
    ];

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      tools,
    });

    // Build history (skip the last user message; it becomes the current prompt)
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const lastUser = messages[messages.length - 1];
    if (!lastUser || lastUser.role !== "user") {
      return NextResponse.json({ error: "Last message must be from user" }, { status: 400 });
    }

    const chat = model.startChat({ history });

    let result = await chat.sendMessage(lastUser.content);
    let response = result.response;

    // Handle function calls (up to a few rounds)
    const maxRounds = 5;
    for (let i = 0; i < maxRounds; i++) {
      const functionCalls = response.functionCalls();
      if (!functionCalls || functionCalls.length === 0) break;

      const functionResponses = [];
      for (const call of functionCalls) {
        try {
          const output = executeTool(call.name, call.args as Record<string, unknown>);
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: { result: output },
            },
          });
        } catch (err: any) {
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: { error: err.message || String(err) },
            },
          });
        }
      }

      result = await chat.sendMessage(functionResponses);
      response = result.response;
    }

    const text = response.text();
    return NextResponse.json({ reply: text });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

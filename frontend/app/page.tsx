"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "What skills are in the dataset?",
  "Find remote Python jobs",
  "How many postings does TechNova have?",
  "Show me job #4",
  "Search for React roles",
];

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("gemini_api_key");
    if (stored) {
      setApiKey(stored);
      setKeySaved(true);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function saveKey() {
    if (apiKey.trim()) {
      localStorage.setItem("gemini_api_key", apiKey.trim());
      setKeySaved(true);
    }
  }

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setError(null);
    const userMsg: Message = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          apiKey: apiKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Jobs MCP · Gemini</h1>
        <span className="badge">MCP tools + Gemini function calling</span>
      </header>

      <div className="key-bar">
        <input
          type="password"
          placeholder="Paste your Gemini API key…"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setKeySaved(false);
          }}
        />
        <button type="button" onClick={saveKey}>
          Save
        </button>
        <span className={`status ${keySaved ? "ok" : ""}`}>
          {keySaved ? "✓ Saved locally" : "Not saved"}
        </span>
      </div>

      {messages.length === 0 ? (
        <div className="empty">
          <h2>Ask about the job postings</h2>
          <p>
            The assistant uses the same tools as the MCP server
            (<code> search_postings_by_skill</code>,{" "}
            <code>count_postings_by_company</code>, etc.).
          </p>
        </div>
      ) : (
        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          ))}
          {loading && (
            <div className="message assistant">Thinking…</div>
          )}
          {error && <div className="message error">{error}</div>}
          <div ref={bottomRef} />
        </div>
      )}

      {messages.length === 0 && (
        <div className="suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form className="composer" onSubmit={onSubmit}>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Ask about jobs, skills, companies…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

'use client';

import { useState, useRef } from 'react';
import { useChat } from '@ai-sdk/react';

export default function AgentCanvas() {
  const { messages, sendMessage, status, addToolOutput, error } = useChat();
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isLoading = status === 'submitted' || status === 'streaming';

  // Find active clarification popup scanning all message parts
  let activeClarification: any = null;
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (
        part.type === 'tool-request_clarification' &&
        (part as any).state === 'input-available'
      ) {
        activeClarification = part;
        break;
      }
    }
    if (activeClarification) break;
  }

  const handleChoice = (choiceId: string, toolCallId: string) => {
    addToolOutput({
      tool: 'request_clarification' as never,
      toolCallId,
      output: `User selected: ${choiceId}. Proceed.`,
    });
  };

  const readFile = async (f: File): Promise<string> => {
    if (f.name.endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const arrayBuffer = await f.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }
    return f.text();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !files?.length) || isLoading) return;

    let text = input;

    if (files && files.length > 0) {
      const fileTexts = await Promise.all(
        Array.from(files).map(async (f) => {
          const content = await readFile(f);
          return `\n\n--- FILE: ${f.name} ---\n${content}\n--- END: ${f.name} ---`;
        })
      );
      text = text + fileTexts.join('');
    }

    sendMessage({ text });
    setInput('');
    setFiles(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-mono">
      <header className="border-b border-neutral-800 p-4 flex justify-between items-center">
        <h1 className="text-lg font-bold tracking-widest text-neutral-400">AGENT.FACTORY</h1>
        <span className="text-xs bg-neutral-800 px-2 py-1 rounded">CONSTITUTION: ACTIVE</span>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {error && (
          <div className="text-red-400 text-xs border border-red-800 rounded p-3">
            ERROR: {error.message}
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {msg.parts.map((part, i) => {
              if (part.type === 'text') {
                return (
                  <p key={i} className="text-neutral-300 whitespace-pre-wrap">
                    {part.text}
                  </p>
                );
              }

              if (part.type === 'file') {
                const fp = part as any;
                return (
                  <div key={i} className="text-xs text-yellow-400/70 border-l-2 border-yellow-500/50 pl-2 mt-2">
                    [FILE] {fp.filename ?? fp.mediaType ?? 'attachment'}
                  </div>
                );
              }

              const p = part as any;

              if (part.type === 'tool-write_file' && p.state === 'output-available') {
                return (
                  <div key={i} className="text-xs text-emerald-400/70 border-l-2 border-emerald-500/50 pl-2 mt-2">
                    [TRACE] File written &amp; committed: {p.input?.path}
                  </div>
                );
              }

              if (part.type === 'tool-update_project_memory' && p.state === 'output-available') {
                return (
                  <div key={i} className="text-xs text-purple-400/70 border-l-2 border-purple-500/50 pl-2 mt-2">
                    [MEMORY] Project state updated.
                  </div>
                );
              }

              if (part.type === 'tool-request_clarification' && p.state === 'input-available') {
                return null; // rendered separately as popup
              }

              return null;
            })}
          </div>
        ))}

        {activeClarification && (
          <div className="my-8 p-6 bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl max-w-2xl mx-auto">
            <p className="text-sm text-zinc-400 mb-4">{activeClarification.input?.context}</p>

            <div className="space-y-3">
              <button
                onClick={() =>
                  handleChoice(
                    activeClarification.input?.recommendation?.id,
                    activeClarification.toolCallId,
                  )
                }
                className="w-full text-left p-4 rounded-lg bg-blue-900/30 border border-blue-500/50 hover:bg-blue-900/50 transition"
              >
                <span className="text-blue-400 text-xs font-bold block mb-1">RECOMMENDED</span>
                <p className="text-white">{activeClarification.input?.recommendation?.label}</p>
                <p className="text-xs text-zinc-400 mt-1">
                  {activeClarification.input?.recommendation?.rationale}
                </p>
              </button>

              {activeClarification.input?.alternatives?.map((alt: any) => (
                <button
                  key={alt.id}
                  onClick={() => handleChoice(alt.id, activeClarification.toolCallId)}
                  className="w-full text-left p-4 rounded-lg border border-zinc-700 hover:bg-zinc-800 transition"
                >
                  <p className="text-white">{alt.label}</p>
                  <p className="text-xs text-zinc-400 mt-1">{alt.rationale}</p>
                </button>
              ))}
            </div>

            <p className="text-xs text-red-400/80 mt-4 border-t border-zinc-800 pt-3">
              ⚠️ {activeClarification.input?.stack_enforcement_warning}
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-800 space-y-2">
        {files && files.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {Array.from(files).map((f, i) => (
              <span key={i} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded flex items-center gap-1">
                📄 {f.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              activeClarification ? 'Awaiting architectural decision...' : 'Paste a messy feature spec...'
            }
            disabled={isLoading || !!activeClarification}
            className="flex-1 bg-zinc-900 rounded-lg px-4 py-3 outline-none text-sm disabled:opacity-30"
          />
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".txt,.md,.json,.ts,.tsx,.js,.jsx,.py,.yaml,.yml,.csv,.docx"
            className="hidden"
            onChange={(e) => setFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isLoading || !!activeClarification}
            title="Attach spec files"
            className="bg-zinc-800 text-zinc-300 px-4 py-3 rounded-lg text-sm hover:bg-zinc-700 disabled:opacity-30 transition"
          >
            📎
          </button>
          <button
            type="submit"
            disabled={isLoading || !!activeClarification}
            className="bg-white text-black font-bold px-6 py-3 rounded-lg text-sm disabled:opacity-30"
          >
            {isLoading ? 'Running...' : 'Execute'}
          </button>
        </div>
      </form>
    </div>
  );
}

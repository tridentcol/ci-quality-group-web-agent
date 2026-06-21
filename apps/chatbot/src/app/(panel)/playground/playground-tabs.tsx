"use client";

import { useState } from "react";
import { MessageSquare, Search, FileCode, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { Playground } from "./playground";
import { RagInspector } from "./rag-inspector";
import { PromptViewer } from "./prompt-viewer";
import { Scenarios } from "./scenarios";

type Tab = "chat" | "rag" | "prompt" | "scenarios";

const TABS: { id: Tab; label: string; Icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", Icon: MessageSquare },
  { id: "rag", label: "Inspector RAG", Icon: Search },
  { id: "prompt", label: "Prompt", Icon: FileCode },
  { id: "scenarios", label: "Escenarios", Icon: ListChecks },
];

export function PlaygroundTabs() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div>
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "chat" && <Playground />}
      {tab === "rag" && <RagInspector />}
      {tab === "prompt" && <PromptViewer />}
      {tab === "scenarios" && <Scenarios />}
    </div>
  );
}

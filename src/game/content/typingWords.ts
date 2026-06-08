export type CareerStage = "apply" | "interview" | "project" | "working" | "revision";

export const careerStageLabel: Record<CareerStage, string> = {
  apply: "Melamar Pekerjaan",
  interview: "Interview / Seleksi",
  project: "Dapat Project",
  working: "Mengerjakan Project",
  revision: "Revisi & Deadline",
};

export const typingWordPools: Record<CareerStage, string[]> = {
  apply: [
    "resume", "portfolio", "email", "apply", "interview", "skill", "career",
    "hiring", "recruiter", "deadline", "profile", "experience", "motivation",
    "vacancy", "candidate", "letter", "submit", "upload", "form", "select",
    "company", "office", "position", "role", "salary", "applyer", "hire",
  ],
  interview: [
    "question", "answer", "confidence", "schedule", "meeting", "test",
    "challenge", "review", "feedback", "accepted", "call", "zoom", "room",
    "panel", "score", "nervous", "ready", "speak", "listen", "explain",
    "logic", "result", "passed", "failed", "offer",
  ],
  project: [
    "client", "brief", "project", "contract", "budget", "timeline",
    "proposal", "deal", "payment", "scope", "task", "milestone", "order",
    "request", "price", "plan", "note", "goal", "target", "agenda", "detail",
    "requirement", "agreement", "invoice", "deposit", "phase",
  ],
  working: [
    "design", "coding", "debug", "layout", "feature", "prototype", "testing",
    "revision", "progress", "submit", "deploy", "update", "publish", "build",
    "create", "edit", "draft", "asset", "page", "screen", "button", "icon",
    "menu", "logic", "script", "module", "system", "data",
  ],
  revision: [
    "revision", "feedback", "bug", "error", "delay", "deadline", "urgent",
    "final", "approval", "complete", "finish", "launch", "release", "approve",
    "paid", "profit", "bonus", "star", "rank", "badge", "growth", "trust",
    "expert", "winner",
  ],
};

export function stageForMoney(money: number): CareerStage {
  if (money < 100) return "apply";
  if (money < 200) return "interview";
  if (money < 300) return "project";
  if (money < 400) return "working";
  return "revision";
}

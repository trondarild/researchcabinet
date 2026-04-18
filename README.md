<p align="center">
  <img src="assets/cabinet-wordmark.svg" alt="cabinet /ˈkab.ɪ.nət/" width="920">
</p>

<h1 align="center">🗄️ Research Cabinet</h1>

<p align="center">
  <strong>Your research knowledge base. Your AI lab team.</strong><br />
  <sub>🗂️ Files on disk &nbsp;•&nbsp; 📁 AI workspaces &nbsp;•&nbsp; 🧠 Agents with memory</sub>
</p>

<p align="center">
  An AI-first research OS where everything lives as markdown files on disk. No database. No vendor lock-in. Self-hosted. Your data never leaves your machine.
</p>

---

## From zero to AI research team in 2 minutes

```bash
npx create-cabinet@latest
cd cabinet
npm run dev:all
```

Open [http://localhost:3000](http://localhost:3000). The onboarding wizard builds your custom AI research team in a few questions.

---

## The problem

Every time you start a new AI session, it forgets everything. Your project context, your decisions, your literature notes — gone. Scattered docs across tools. AI sessions with no memory. Manual copy-paste between experiments and notes.

## The solution

One knowledge base. AI agents that remember everything. Scheduled jobs that keep your research current. Your lab's collective memory grows while you work.

> If it feels like enterprise workflow software, it's wrong. If it feels like watching a research team think, it's right.

---

## Philosophy

- **Yours** — Your data stays local, visible, and portable. Not trapped in any provider's ecosystem.
- **Git everything** — Memory should have history. Inspect changes, revert mistakes, audit how knowledge evolves.
- **BYOAI** — Bring your own AI. Works with Claude, Codex, Gemini, and whatever comes next.
- **KISS** — Plain files, clear behavior, systems that researchers and developers can reason about.
- **Self-hosted** — Your research context, literature notes, and experimental logs run in an environment you control.

---

## Everything you need. Nothing you don't.

| Feature | What it does |
|---|---|
| **WYSIWYG + Markdown** | Rich text editing with Tiptap. Tables, code blocks, slash commands. |
| **AI Agents** | Each has goals, skills, scheduled jobs. Watch them work like a real research team. |
| **Scheduled Jobs** | Cron-based agent automation. Literature checks, weekly summaries, protocol reviews. |
| **Embedded HTML Apps** | Drop an `index.html` in any folder — it renders as an iframe. Full-screen mode. |
| **Web Terminal** | Interactive local AI CLI terminal in the browser. |
| **File-Based Everything** | No database. Markdown on disk. Your data is always yours, always portable. |
| **Git-Backed History** | Every save auto-commits. Full diff viewer. Restore any page to any point in time. |
| **Tasks & Projects** | Break research goals into projects. Track progress with Kanban boards. |
| **Internal Chat** | Built-in team channels. Agents and researchers communicate in one place. |
| **Full-Text Search** | Cmd+K instant search across all pages. Fuzzy matching. |
| **PDF & CSV Viewers** | First-class support for PDFs (papers!) and data tables. |
| **Dark/Light Mode** | Theme toggle. Dark mode by default. |

---

## Pre-built research agent team

Cabinet ships with agent templates tailored for research workflows. Each has a role, recurring jobs, and a workspace in the knowledge base.

| Role | Agent |
|---|---|
| **Leadership** | Research Director, Lab Manager, Grants Manager, Computational Lead |
| **Research** | Researcher, Data Analyst |
| **Operations** | Project Coordinator, Editor |
| **Infrastructure** | DevOps Engineer, QA Agent |
| **Communications** | Science Communicator, Legal Advisor |

---

## How it works

1. **Install & Run** — One command. Next.js + daemon start.
2. **Answer a few questions** — Cabinet builds your custom AI research team.
3. **Watch your team work** — Agents review literature, track projects, file reports.
4. **Knowledge compounds** — Every agent run, every edit adds to the KB. Context builds over time.

---

## AI Runtime

- **Tasks, jobs, and heartbeats** run through a provider adapter layer with persisted conversations and live transcript views.
- **Per-run overrides** can choose provider, model, and reasoning effort, while personas and jobs inherit defaults.
- **Current defaults** are structured local adapters: `claude_local` for Claude Code and `codex_local` for Codex CLI.
- **The web terminal** is a first-class interactive surface for direct CLI sessions.

---

## Architecture

```
cabinet/
  src/
    app/api/         -> Next.js API routes
    components/      -> React components (sidebar, editor, agents, jobs, terminal)
    stores/          -> Zustand state management
    lib/             -> Storage, markdown, git, agents, jobs
  server/
    cabinet-daemon.ts -> WebSocket + job scheduler + agent executor
  data/
    .agents/.library/ -> Pre-built agent templates
    getting-started/  -> Default KB page
```

**Tech stack:** Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, Tiptap, Zustand, xterm.js, node-cron

---

## Requirements

- **Node.js** 20+
- At least one supported CLI provider:
  - **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)
  - **Codex CLI** (`npm install -g @openai/codex`)
  - **Gemini CLI** (`npm install -g @google/gemini-cli`)
- macOS or Linux (Windows via WSL)

## Configuration

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|----------|---------|-------------|
| `KB_PASSWORD` | _(empty)_ | Password to protect the UI. Leave empty for no auth. |
| `DOMAIN` | `localhost` | Domain for the app. |

## Commands

```bash
npm run dev          # Next.js dev server (port 3000)
npm run dev:daemon   # Unified daemon: structured runs, terminal sessions, WebSockets, scheduler (port 3001)
npm run dev:all      # Both servers
npm run build        # Production build
npm run start        # Production mode (both servers)
```

---

MIT License

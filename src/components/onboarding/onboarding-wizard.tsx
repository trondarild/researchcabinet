"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  Rocket,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Terminal,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { ProviderGlyph } from "@/components/agents/provider-glyph";
import type { ProviderInfo } from "@/types/agents";
import type { RegistryTemplate } from "@/lib/registry/registry-manifest";
import { RegistryBrowser } from "@/components/registry/registry-browser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getModelEffortLevels,
  getSuggestedProviderEffort,
  resolveProviderEffort,
  resolveProviderModel,
} from "@/lib/agents/runtime-options";

interface OnboardingAnswers {
  name: string;
  role: string;
  companyName: string;
  description: string;
  teamSize: string;
  priority: string;
}

interface SuggestedAgent {
  slug: string;
  name: string;
  emoji: string;
  role: string;
  checked: boolean;
}


const RUNCABINET_URL = "https://runcabinet.com";
const ROLES = ["Principal Investigator", "Researcher", "Lab Manager", "Data Scientist", "Research Engineer", "Other"];
const TEAM_SIZES = ["Just me", "2-5", "5-20", "20+"];
const LAUNCH_STEP = 4;
const STEP_COUNT = 5;

/* ─── Colors from runcabinet.com ─── */
const WEB = {
  bg: "#FAF6F1",
  bgWarm: "#F3EDE4",
  bgCard: "#FFFFFF",
  text: "#3B2F2F",
  textSecondary: "#6B5B4F",
  textTertiary: "#A89888",
  accent: "#8B5E3C",
  accentWarm: "#7A4F30",
  accentBg: "#F5E6D3",
  border: "#E8DDD0",
  borderLight: "#F0E8DD",
  borderDark: "#D4C4B0",
} as const;


/* ─── Keyword → agent pre-check mapping ─── */
const KEYWORD_CHECKS: [RegExp, string[]][] = [
  [/literature|papers|reading|review/, ["researcher", "trend-scout"]],
  [/data|analysis|statistics|pipeline|computation/, ["data-analyst", "cto"]],
  [/grant|funding|budget|neh|nsf|erc/, ["cfo", "copywriter"]],
  [/publish|manuscript|journal|paper|submission/, ["post-optimizer", "editor"]],
  [/outreach|communication|social|twitter|blog/, ["content-marketer", "social-media"]],
  [/experiment|protocol|methods|design/, ["researcher"]],
  [/seminar|teaching|course|lecture/, ["researcher"]],
  [/quality|review|proofread|audit/, ["qa"]],
  [/code|software|infra|deploy|compute/, ["cto", "devops"]],
  [/project|milestone|planning|coordination/, ["product-manager"]],
  [/legal|compliance|contract|ethics/, ["legal"]],
  [/hiring|onboarding|team|members/, ["people-ops"]],
  [/operations|process|lab management/, ["coo"]],
];

const ALWAYS_CHECKED = new Set(["ceo", "editor"]);

interface PreMadeTeam {
  name: string;
  description: string;
  agents: number;
  domain: string;
}

const PRE_MADE_TEAMS: PreMadeTeam[] = [
  { name: "Neuroscience Lab", description: "Literature review, data analysis, and grant tracking for systems neuroscience", agents: 4, domain: "Life Sciences" },
  { name: "Computational Lab", description: "Pipeline management, reproducibility, and publication support", agents: 3, domain: "Computation" },
  { name: "Clinical Research Unit", description: "Protocol management, regulatory docs, and milestone tracking", agents: 4, domain: "Clinical" },
  { name: "Solo Researcher", description: "Literature, writing, and project management for one", agents: 2, domain: "Research" },
  { name: "Theory Group", description: "Argument mapping, seminar planning, and manuscript review", agents: 3, domain: "Humanities" },
  { name: "Ecology Field Lab", description: "Field data, species tracking, and conservation reporting", agents: 4, domain: "Life Sciences" },
  { name: "Social Science Lab", description: "Survey design, qualitative coding, and ethics review", agents: 4, domain: "Social Science" },
  { name: "Materials Science Group", description: "Characterization data, synthesis protocols, and patent tracking", agents: 4, domain: "Engineering" },
];

const TEAM_DOMAIN_COLORS: Record<string, { bg: string; text: string }> = {
  "Life Sciences": { bg: "#E8F5E9", text: "#2E7D32" },
  Computation: { bg: "#E3F2FD", text: "#1565C0" },
  Clinical: { bg: "#FCE4EC", text: "#B0475A" },
  Research: { bg: "#EDE7F6", text: "#6B4FA0" },
  Humanities: { bg: "#FFF8E1", text: "#8D7039" },
  "Social Science": { bg: "#E0F2F1", text: "#3A7A6D" },
  Engineering: { bg: "#FBE9E7", text: "#BF360C" },
};

function TerminalCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2 mt-1.5 font-mono text-[12px]"
      style={{ background: "#1e1e1e", color: "#d4d4d4" }}
    >
      <span style={{ color: "#6A9955" }}>$</span>
      <span className="flex-1 select-all">{command}</span>
      <button
        onClick={copy}
        className="shrink-0 p-1 rounded transition-colors hover:bg-white/10"
        title="Copy to clipboard"
      >
        {copied ? (
          <ClipboardCheck className="size-3.5" style={{ color: "#6A9955" }} />
        ) : (
          <Copy className="size-3.5" style={{ color: "#808080" }} />
        )}
      </button>
    </div>
  );
}

function TeamCarousel({
  templates,
  onSelect,
}: {
  templates: RegistryTemplate[];
  onSelect: (t: RegistryTemplate) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Use real templates if loaded, otherwise fall back to hardcoded placeholders
  const items = templates.length > 0 ? templates : PRE_MADE_TEAMS;
  const isReal = templates.length > 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let animationId: number;
    let position = 0;

    const animate = () => {
      if (!isPaused) {
        position += 1.2;
        const halfWidth = el.scrollWidth / 2;
        if (position >= halfWidth) position = 0;
        el.style.transform = `translateX(-${position}px)`;
      }
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isPaused]);

  const doubled = [...items, ...items];

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div ref={scrollRef} className="flex gap-2 will-change-transform">
        {doubled.map((item, i) => {
          const domain = "domain" in item ? item.domain : "";
          const agentCount = "agentCount" in item ? item.agentCount : ("agents" in item ? (item as PreMadeTeam).agents : 0);
          const colors = TEAM_DOMAIN_COLORS[domain] || { bg: WEB.accentBg, text: WEB.accent };
          return (
            <button
              key={`${item.name}-${i}`}
              className="flex-shrink-0 w-44 rounded-lg p-3 flex flex-col text-left transition-all hover:-translate-y-0.5"
              style={{
                border: `1px solid ${WEB.border}`,
                background: WEB.bgCard,
                height: 88,
                cursor: isReal ? "pointer" : "default",
              }}
              onClick={() => {
                if (isReal) onSelect(item as RegistryTemplate);
              }}
            >
              <p className="text-[11px] font-medium leading-tight" style={{ color: WEB.text }}>
                {item.name}
              </p>
              <p className="text-[10px] mt-1 leading-snug line-clamp-2" style={{ color: WEB.textSecondary }}>
                {item.description}
              </p>
              <div className="flex items-center justify-between mt-auto">
                <span
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: colors.bg, color: colors.text }}
                >
                  {domain}
                </span>
                <span className="text-[9px]" style={{ color: WEB.textTertiary }}>
                  {agentCount} agents
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IntroStep({ onNext }: { onNext: () => void }) {
  const phase = 8;

  const fade = (_p: number): CSSProperties => ({
    opacity: 1,
    transform: "translateY(0)",
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:gap-10 w-full">
        {/* Dictionary Definition Card */}
        <div
          className="text-left rounded-2xl px-8 py-8 md:px-10 md:py-10 flex-1"
          style={{
            background: WEB.bgCard,
            border: `1px solid ${WEB.border}`,
            boxShadow: "0 1px 3px rgba(59, 47, 47, 0.04), 0 8px 30px rgba(59, 47, 47, 0.04)",
          }}
        >
          <div className="flex items-baseline gap-3 mb-1" style={fade(1)}>
            <h1
              className="font-logo text-4xl sm:text-5xl tracking-tight italic"
              style={{ color: WEB.text }}
            >
              research cabinet
            </h1>
          </div>
          <p
            className="font-mono text-xs italic mb-6"
            style={{ ...fade(2), color: WEB.textTertiary }}
          >
            noun
          </p>

          <ol className="font-body-serif space-y-5 text-[15px] leading-relaxed">
            <li className="flex gap-3" style={fade(3)}>
              <span className="font-logo italic text-lg mt-[-2px] shrink-0" style={{ color: WEB.accent }}>1.</span>
              <div>
                <p style={{ color: WEB.textSecondary }}>
                  A cupboard with shelves or drawers for storing or displaying items.
                </p>
                <p className="font-mono text-xs italic mt-1.5" style={{ color: WEB.textTertiary }}>
                  &ldquo;a filing cabinet&rdquo;
                </p>
              </div>
            </li>
            <li className="flex gap-3" style={fade(4)}>
              <span className="font-logo italic text-lg mt-[-2px] shrink-0" style={{ color: WEB.accent }}>2.</span>
              <div>
                <p style={{ color: WEB.textSecondary }}>
                  <span
                    className="font-mono text-[11px] uppercase tracking-wider mr-1.5 px-1.5 py-0.5 rounded"
                    style={{ color: WEB.textTertiary, background: "#F5F0EB" }}
                  >
                    politics
                  </span>
                  The committee of senior ministers responsible for controlling government policy.
                </p>
                <p className="font-mono text-xs italic mt-1.5" style={{ color: WEB.textTertiary }}>
                  &ldquo;a cabinet meeting&rdquo;
                </p>
              </div>
            </li>
            <li className="flex gap-3" style={fade(5)}>
              <span className="font-logo italic text-lg mt-[-2px] shrink-0" style={{ color: WEB.accent }}>3.</span>
              <div>
                <p style={{ color: WEB.text }}>
                  <span
                    className="font-mono text-[11px] uppercase tracking-wider mr-1.5 px-1.5 py-0.5 rounded"
                    style={{ color: WEB.accent, background: WEB.accentBg }}
                  >
                    software
                  </span>
                  An AI-first knowledge base for scientific research, where a team of AI agents review literature, track projects, and draft outputs — while you do the thinking.
                </p>
                <p className="font-mono text-xs italic mt-1.5" style={{ color: WEB.textTertiary }}>
                  &ldquo;I asked my cabinet to review the literature and draft the methods section&rdquo;
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* Tagline + CTA */}
        <div className="flex flex-col items-center lg:items-start gap-6 py-6 lg:py-0 lg:max-w-xs shrink-0">
          <h2 className="text-center lg:text-left text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.1]">
            <span className="font-logo italic" style={{ ...fade(6), color: WEB.text, display: "inline-block" }}>
              Your research memory.
            </span>
            <br />
            <span
              className="font-logo italic"
              style={{
                ...fade(7),
                display: "inline-block",
                background: "linear-gradient(135deg, #3B2F2F 0%, #8B5E3C 50%, #A0714D 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Your AI lab team.
            </span>
          </h2>

          <div style={fade(8)}>
            <button
              onClick={onNext}
              className="inline-flex items-center justify-center gap-2.5 rounded-full px-10 py-4 text-base font-medium text-white transition-all hover:-translate-y-0.5 shadow-sm w-full lg:w-auto"
              style={{ background: WEB.accent }}
            >
              Get started
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Cabinet Created — animated tree after import ─── */

function CabinetCreatedScreen({
  cabinetName,
  template,
  onContinue,
}: {
  cabinetName: string;
  template: RegistryTemplate;
  onContinue: () => void;
}) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [showButton, setShowButton] = useState(false);

  const treeLines = useMemo(() => {
    const lines: { text: string; indent: number; icon?: string }[] = [];
    lines.push({ text: cabinetName, indent: 0, icon: "📦" });
    lines.push({ text: ".cabinet", indent: 1 });
    lines.push({ text: ".agents/", indent: 1 });
    if (template.agentCount > 0) {
      const count = template.agentCount;
      lines.push({ text: `${count} agent${count > 1 ? "s" : ""} ready to work`, indent: 2, icon: "🤖" });
    }
    lines.push({ text: ".jobs/", indent: 1 });
    if (template.jobCount > 0) {
      const count = template.jobCount;
      lines.push({ text: `${count} scheduled job${count > 1 ? "s" : ""}`, indent: 2, icon: "⏱" });
    }
    if (template.childCount > 0) {
      lines.push({ text: `${template.childCount} sub-cabinet${template.childCount > 1 ? "s" : ""}`, indent: 2, icon: "📂" });
    }
    lines.push({ text: ".cabinet-state/", indent: 1 });
    lines.push({ text: "index.md", indent: 1 });
    return lines;
  }, [cabinetName, template]);

  useEffect(() => {
    if (visibleLines >= treeLines.length) {
      const t = setTimeout(() => setShowButton(true), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setVisibleLines((c) => c + 1),
      visibleLines === 0 ? 500 : 250 + Math.random() * 150
    );
    return () => clearTimeout(t);
  }, [visibleLines, treeLines.length]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-8 ">
      <div className="text-center space-y-2">
        <CheckCircle2 className="size-10 mx-auto" style={{ color: WEB.accent }} />
        <h1 className="font-logo text-2xl tracking-tight italic" style={{ color: WEB.text }}>
          Your cabinet has been created
        </h1>
        <p className="text-sm" style={{ color: WEB.textSecondary }}>
          Everything is set up and ready to go.
        </p>
      </div>

      {/* Animated tree */}
      <div
        className="w-full rounded-xl px-6 py-5 font-mono text-[13px] leading-relaxed"
        style={{ background: WEB.bgCard, border: `1px solid ${WEB.border}` }}
      >
        {treeLines.map((line, i) => {
          const isVisible = i < visibleLines;
          const isRoot = i === 0;
          // Build the tree connector prefix
          let prefix = "";
          if (!isRoot && line.indent === 1) {
            // Check if this is the last indent-1 line
            const hasMoreAtSameLevel = treeLines.slice(i + 1).some((l) => l.indent === 1);
            prefix = hasMoreAtSameLevel ? "├── " : "└── ";
          } else if (line.indent === 2) {
            // Sub-item under a parent
            const hasMoreSiblings = treeLines.slice(i + 1).some(
              (l) => l.indent === 2 && treeLines.slice(i + 1).indexOf(l) < treeLines.slice(i + 1).findIndex((x) => x.indent <= 1)
            );
            prefix = "│   " + (hasMoreSiblings ? "├── " : "└── ");
          }

          return (
            <div
              key={i}
              className="transition-all duration-300"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateX(0)" : "translateX(-8px)",
              }}
            >
              {isRoot ? (
                <span style={{ color: WEB.accent, fontWeight: 600 }}>
                  {line.icon} {line.text}
                </span>
              ) : (
                <span style={{ color: WEB.textSecondary }}>
                  <span style={{ color: WEB.borderDark }}>{prefix}</span>
                  {line.icon ? `${line.icon} ` : ""}
                  {line.text}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Continue button */}
      <button
        onClick={onContinue}
        className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-medium text-white transition-all hover:-translate-y-0.5 duration-300"
        style={{
          background: WEB.accent,
          opacity: showButton ? 1 : 0,
          transform: showButton ? "translateY(0)" : "translateY(8px)",
        }}
      >
        Continue setup
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ─── Welcome Back — shown when .cabinet already exists ─── */

function WelcomeBackStep({
  cabinetName,
  onNext,
}: {
  cabinetName?: string;
  onNext: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-8 ">
      <div
        className="text-center space-y-3 transition-all duration-700"
        style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(12px)" }}
      >
        <CheckCircle2 className="size-10 mx-auto" style={{ color: WEB.accent }} />
        <h1 className="font-logo text-2xl tracking-tight italic" style={{ color: WEB.text }}>
          Welcome back{cabinetName ? ` to ${cabinetName}` : ""}
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: WEB.textSecondary }}>
          We found an existing cabinet here. Let&apos;s finish setting it up.
        </p>
      </div>

      <button
        onClick={onNext}
        className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-medium text-white transition-all hover:-translate-y-0.5 duration-300"
        style={{
          background: WEB.accent,
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(8px)",
        }}
      >
        Continue
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function TeamBuildStep({
  agentsLoading,
  suggestedAgents,
  libraryTemplates,
  launchDisabled,
  selectedCount,
  maxAgents,
  toggleAgent,
  onBack,
  onNext,
}: {
  agentsLoading: boolean;
  suggestedAgents: SuggestedAgent[];
  libraryTemplates: LibraryTemplate[];
  launchDisabled: boolean;
  selectedCount: number;
  maxAgents: number;
  toggleAgent: (slug: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [phase, setPhase] = useState(0);
  // phase 0: title
  // phase 1: "import" label
  // phase 2: carousel visible
  // phase 3: (reserved)
  // phase 4: "or pick" label + agents

  const [registryTemplates, setRegistryTemplates] = useState<RegistryTemplate[]>([]);
  const [importTemplate, setImportTemplate] = useState<RegistryTemplate | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importName, setImportName] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedSlugs, setImportedSlugs] = useState<Set<string>>(new Set());
  const [registryOpen, setRegistryOpen] = useState(false);
  const [importedCabinet, setImportedCabinet] = useState<{ name: string; template: RegistryTemplate } | null>(null);

  useEffect(() => {
    fetch("/api/registry")
      .then((r) => r.json())
      .then((data) => {
        if (data.templates) setRegistryTemplates(data.templates);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(4), 2200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleImport = async () => {
    if (!importTemplate) return;
    setImportBusy(true);
    setImportError(null);
    try {
      const res = await fetch("/api/registry/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: importTemplate.slug,
          name: importName.trim() !== importTemplate.name ? importName.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setImportError(data?.error || "Import failed");
        setImportBusy(false);
        return;
      }
      setImportedSlugs((prev) => new Set(prev).add(importTemplate.slug));
      setImportOpen(false);
      setImportedCabinet({ name: importName.trim() || importTemplate.name, template: importTemplate });
      setImportTemplate(null);
    } catch {
      setImportError("Import failed. Check your connection.");
    } finally {
      setImportBusy(false);
    }
  };

  // ── Success screen after import ──
  if (importedCabinet) {
    return (
      <CabinetCreatedScreen
        cabinetName={importedCabinet.name}
        template={importedCabinet.template}
        onContinue={onNext}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Title */}
      <div
        className="text-center space-y-2 transition-all duration-500"
        style={{ opacity: 1 }}
      >
        <h1 className="font-logo text-2xl tracking-tight italic">
          Build <span style={{ color: WEB.accent }}>your</span> team
        </h1>
        <p className="text-sm" style={{ color: WEB.textSecondary }}>
          Each cabinet is an AI team — agents, tasks, and a shared knowledge base, working together as one.
        </p>
      </div>

      {/* Carousel section */}
      <div
        className="space-y-2 transition-all duration-700"
        style={{
          width: "100vw",
          marginLeft: "calc(-50vw + 50%)",
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? "translateY(0)" : "translateY(12px)",
        }}
      >
        <div className="flex items-center justify-center gap-3">
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: WEB.textTertiary }}
          >
            Import a pre-made zero-human team
          </p>
          <button
            onClick={() => setRegistryOpen(true)}
            className="text-[11px] font-semibold transition-colors"
            style={{ color: WEB.accent }}
          >
            Browse all &rarr;
          </button>
        </div>
        <div
          className="transition-opacity duration-500"
          style={{ opacity: phase >= 2 ? 1 : 0 }}
        >
          <TeamCarousel
            templates={registryTemplates}
            onSelect={(t) => {
              setImportTemplate(t);
              setImportName(t.name);
              setImportError(null);
              setImportOpen(true);
            }}
          />
        </div>
        {importedSlugs.size > 0 && (
          <p
            className="text-[10px] font-medium text-center mt-1"
            style={{ color: WEB.accent }}
          >
            <CheckCircle2 className="inline size-3 mr-1 -mt-px" />
            {importedSlugs.size} cabinet{importedSlugs.size > 1 ? "s" : ""} imported
          </p>
        )}
      </div>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={(v) => { if (!importBusy) setImportOpen(v); }}>
        <DialogContent
          className="sm:max-w-md"
          style={{ background: WEB.bg, border: `1px solid ${WEB.border}`, color: WEB.text }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: WEB.text }}>
              Import {importTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          {importTemplate && (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: WEB.textSecondary }}>
                {importTemplate.description}
              </p>
              <div className="flex gap-4 text-xs" style={{ color: WEB.textTertiary }}>
                <span>{importTemplate.agentCount} agents</span>
                <span>{importTemplate.jobCount} jobs</span>
                {importTemplate.childCount > 0 && (
                  <span>{importTemplate.childCount} sub-cabinets</span>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: WEB.textSecondary }}>
                  Cabinet name
                </label>
                <input
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    border: `1px solid ${WEB.border}`,
                    background: WEB.bgCard,
                    color: WEB.text,
                    outline: "none",
                  }}
                />
              </div>
              {importError && (
                <p className="text-xs" style={{ color: "#c0392b" }}>{importError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setImportOpen(false)}
                  disabled={importBusy}
                  className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
                  style={{ color: WEB.textSecondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importBusy || !importName.trim()}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium text-white transition-all disabled:opacity-40"
                  style={{ background: WEB.accent }}
                >
                  {importBusy ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
                  Import
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Registry browser — full-screen overlay */}
      {registryOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: WEB.bg }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${WEB.border}` }}>
            <h2 className="font-logo text-xl italic" style={{ color: WEB.text }}>
              Browse cabinets
            </h2>
            <button
              onClick={() => setRegistryOpen(false)}
              className="flex items-center justify-center size-8 rounded-full transition-colors"
              style={{ color: WEB.textSecondary, background: WEB.bgWarm }}
            >
              <XCircle className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <RegistryBrowser />
          </div>
        </div>
      )}

      {/* Agent selection */}
      <div
        className="transition-all duration-700"
        style={{
          width: "100vw",
          marginLeft: "calc(-50vw + 50%)",
          opacity: phase >= 4 ? 1 : 0,
          transform: phase >= 4 ? "translateY(0)" : "translateY(12px)",
        }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-wider text-center mb-2"
          style={{ color: WEB.textTertiary }}
        >
          Or pick your agents{" "}
          <span style={{ color: selectedCount >= maxAgents ? WEB.accent : WEB.textTertiary }}>
            ({selectedCount}/{maxAgents})
          </span>
        </p>
        {agentsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin" style={{ color: WEB.textTertiary }} />
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto px-6 pb-2 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
            {groupByDepartment(suggestedAgents, libraryTemplates).map(([label, agents]) => (
              <div
                key={label}
                className="rounded-xl p-3 shrink-0"
                style={{ background: WEB.bgWarm, width: 180 }}
              >
                <p
                  className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: WEB.textTertiary }}
                >
                  {label}
                </p>
                <div className="flex flex-col gap-1.5">
                  {agents.map((agent) => {
                    const isMandatory = ALWAYS_CHECKED.has(agent.slug);
                    const atLimit = selectedCount >= maxAgents && !agent.checked;
                    return (
                      <button
                        key={agent.slug}
                        onClick={() => toggleAgent(agent.slug)}
                        disabled={isMandatory || atLimit}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all"
                        style={{
                          border: `1px solid ${agent.checked ? WEB.accent : WEB.border}`,
                          background: agent.checked ? WEB.accentBg : WEB.bgCard,
                          opacity: atLimit ? 0.45 : 1,
                          cursor: isMandatory ? "default" : atLimit ? "not-allowed" : "pointer",
                        }}
                      >
                        <div
                          className="flex size-3.5 shrink-0 items-center justify-center rounded"
                          style={{
                            border: `1.5px solid ${agent.checked ? WEB.accent : WEB.borderDark}`,
                            background: agent.checked ? WEB.accent : "transparent",
                          }}
                        >
                          {agent.checked && (
                            <Check className="size-2 text-white" />
                          )}
                        </div>
                        <span className="text-xs">{agent.emoji}</span>
                        <p className="text-[11px] font-medium truncate" style={{ color: WEB.text }}>
                          {agent.name}
                        </p>
                        {isMandatory && (
                          <span
                            className="ml-auto text-[9px] font-medium uppercase tracking-wide shrink-0"
                            style={{ color: WEB.textTertiary }}
                          >
                            Required
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors"
          style={{ color: WEB.textSecondary }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={launchDisabled}
          className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          style={{ background: WEB.accent }}
        >
          Next
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

const DEPARTMENT_ORDER: [string, string][] = [
  ["leadership", "Leadership"],
  ["research", "Research"],
  ["analytics", "Research"],
  ["engineering", "Engineering"],
  ["operations", "Operations"],
  ["administration", "Operations"],
  ["hr", "Operations"],
  ["communications", "Communications"],
  ["design", "Communications"],
  ["legal", "Legal & Admin"],
  ["finance", "Legal & Admin"],
  ["publishing", "Communications"],
];

function getDepartmentLabel(dept: string): string {
  const entry = DEPARTMENT_ORDER.find(([key]) => key === dept);
  return entry ? entry[1] : "Other";
}

function computeChecked(answers: OnboardingAnswers): Set<string> {
  const checked = new Set(ALWAYS_CHECKED);
  const desc = (answers.description + " " + answers.role + " " + answers.priority).toLowerCase();

  for (const [pattern, slugs] of KEYWORD_CHECKS) {
    if (pattern.test(desc)) {
      for (const s of slugs) checked.add(s);
    }
  }

  // Fallback: ensure at least 3 agents are pre-checked
  if (checked.size < 3) {
    checked.add("content-marketer");
    if (checked.size < 3) checked.add("product-manager");
  }

  return checked;
}

interface LibraryTemplate {
  slug: string;
  name: string;
  emoji: string;
  role: string;
  department: string;
  type: string;
}

function groupByDepartment(agents: SuggestedAgent[], templates: LibraryTemplate[]): [string, SuggestedAgent[]][] {
  const deptMap = new Map<string, string>();
  for (const t of templates) deptMap.set(t.slug, t.department);

  const groups = new Map<string, SuggestedAgent[]>();
  for (const agent of agents) {
    const label = getDepartmentLabel(deptMap.get(agent.slug) || "general");
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(agent);
  }

  // Sort groups by the predefined order
  const labelOrder = Array.from(new Set(DEPARTMENT_ORDER.map(([, l]) => l))).concat("Other");
  return labelOrder
    .filter((label) => groups.has(label))
    .map((label) => [label, groups.get(label)!]);
}

/* ─── Agent Chat Preview (launch step) ─── */

function AgentChatPreview({ agents, companyName }: { agents: SuggestedAgent[]; companyName: string }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build conversation script from the selected agents
  const messages = useMemo(() => {
    const ceo = agents.find((a) => a.slug === "ceo") || agents[0];
    const others = agents.filter((a) => a.slug !== ceo?.slug);
    if (!ceo) return [];

    const script: { agent: SuggestedAgent; text: string }[] = [
      { agent: ceo, text: `Good morning team! Welcome to ${companyName || "the lab"}. Let's have a productive week.` },
    ];

    if (others[0]) {
      script.push(
        { agent: ceo, text: `${others[0].name}, can you start a literature review on our main research question?` },
        { agent: others[0], text: "On it. I'll have a summary of key papers ready by end of day." },
      );
    }
    if (others[1]) {
      script.push(
        { agent: ceo, text: `${others[1].name}, let's get our project milestones documented.` },
        { agent: others[1], text: "Already drafting a plan. I'll share it in #general shortly." },
      );
    }
    if (others[0] && others[1]) {
      script.push(
        { agent: others[0], text: `${others[1].name}, I found some relevant recent preprints. Want to review them together?` },
        { agent: others[1], text: "Yes! I can fold those findings into our research brief." },
      );
    }
    if (others[2]) {
      script.push(
        { agent: ceo, text: `${others[2].name}, what's the status on your side?` },
        { agent: others[2], text: "Setting up the analysis environment now. Looking good so far." },
      );
    }
    script.push(
      { agent: ceo, text: "Great start everyone. Let's make this a strong first week." },
    );

    return script;
  }, [agents, companyName]);

  useEffect(() => {
    if (visibleCount >= messages.length) return;
    const timer = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, visibleCount === 0 ? 600 : 1200 + Math.random() * 800);
    return () => clearTimeout(timer);
  }, [visibleCount, messages.length]);

  useEffect(() => {
    const el = scrollRef.current?.parentElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visibleCount]);

  return (
    <div ref={scrollRef} className="space-y-0.5">
      {messages.slice(0, visibleCount).map((msg, i) => {
        const prevAgent = i > 0 ? messages[i - 1].agent.slug : null;
        const isConsecutive = prevAgent === msg.agent.slug;
        return (
          <div
            key={i}
            className="onboarding-chat-msg flex gap-2.5 px-1"
            style={{
              paddingTop: isConsecutive ? 1 : 8,
              animationDelay: "0s",
            }}
          >
            {/* Avatar column */}
            <div className="w-5 shrink-0 flex justify-center">
              {!isConsecutive && <span className="text-sm leading-none mt-0.5">{msg.agent.emoji}</span>}
            </div>
            {/* Message */}
            <div className="flex-1 min-w-0">
              {!isConsecutive && (
                <span
                  className="text-[11px] font-semibold block mb-0.5"
                  style={{ color: WEB.accent }}
                >
                  {msg.agent.name}
                </span>
              )}
              <p className="text-[11px] leading-relaxed" style={{ color: WEB.text }}>
                {msg.text}
              </p>
            </div>
          </div>
        );
      })}
      {/* Typing indicator */}
      {visibleCount < messages.length && visibleCount > 0 && (
        <div className="flex gap-2.5 px-1 pt-2">
          <div className="w-5 shrink-0 flex justify-center">
            <span className="text-sm leading-none mt-0.5">{messages[visibleCount]?.agent.emoji}</span>
          </div>
          <div className="flex items-center gap-1 py-1">
            <span className="onboarding-typing-dot size-1.5 rounded-full" style={{ background: WEB.textTertiary, animationDelay: "0s" }} />
            <span className="onboarding-typing-dot size-1.5 rounded-full" style={{ background: WEB.textTertiary, animationDelay: "0.15s" }} />
            <span className="onboarding-typing-dot size-1.5 rounded-full" style={{ background: WEB.textTertiary, animationDelay: "0.3s" }} />
          </div>
        </div>
      )}
      <style>{`
        @keyframes onboarding-chat-appear {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes onboarding-typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-3px); opacity: 1; }
        }
        .onboarding-chat-msg {
          animation: onboarding-chat-appear 0.3s ease-out both;
        }
        .onboarding-typing-dot {
          animation: onboarding-typing-bounce 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/* ─── Dot-grid background (from runcabinet.com) ─── */
const dotGridStyle: React.CSSProperties = {
  backgroundImage: `radial-gradient(circle, ${WEB.borderDark} 0.5px, transparent 0.5px)`,
  backgroundSize: "32px 32px",
};

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    name: "",
    role: "",
    companyName: "",
    description: "",
    teamSize: "",
    priority: "",
  });
  const [suggestedAgents, setSuggestedAgents] = useState<SuggestedAgent[]>([]);
  const [libraryTemplates, setLibraryTemplates] = useState<LibraryTemplate[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedEffort, setSelectedEffort] = useState<string | null>(null);
  const [cabinetManifest, setCabinetManifest] = useState<{ name?: string; description?: string } | null>(null);
  const [isExistingCabinet, setIsExistingCabinet] = useState(false);
  const readyProviders = providers.filter((p) => p.available && p.authenticated);
  const anyProviderReady = readyProviders.length > 0;
  const activeProvider = providers.find((p) => p.id === selectedProvider);
  const activeModel = resolveProviderModel(
    activeProvider,
    selectedModel || undefined,
    undefined
  );
  const activeModels = activeProvider?.models || [];
  const activeEffortLevels = getModelEffortLevels(activeProvider, activeModel?.id);


  useEffect(() => {
    fetch("/api/system/cabinet-manifest")
      .then((r) => r.json())
      .then((data) => {
        if (data.exists && data.manifest) {
          setIsExistingCabinet(true);
          setCabinetManifest(data.manifest);
          if (data.manifest.name) {
            setAnswers((prev) => ({
              ...prev,
              companyName: prev.companyName || data.manifest.name,
            }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const checkProvider = useCallback(async () => {
    setProvidersLoading(true);
    try {
      const res = await fetch("/api/agents/providers");
      if (!res.ok) throw new Error("Failed to check providers");
      const data = await res.json();
      const cliProviders: ProviderInfo[] = (data.providers ?? []).filter(
        (p: ProviderInfo) => p.type === "cli"
      );
      setProviders(cliProviders);
      // Auto-select first ready provider if none selected
      const ready = cliProviders.filter((p) => p.available && p.authenticated);
      if (ready.length > 0 && !selectedProvider) {
        const first = ready[0];
        const firstModelId = first.models?.[0]?.id ?? null;
        setSelectedProvider(first.id);
        setSelectedModel(firstModelId);
        setSelectedEffort(
          getSuggestedProviderEffort(first, firstModelId || undefined)?.id || null
        );
      }
    } catch {
      setProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  }, [selectedProvider]);

  useEffect(() => {
    if (step === 3) {
      void checkProvider();
    }
  }, [step, checkProvider]);

  const goToTeamSuggestion = async () => {
    setStep(2);
    setAgentsLoading(true);
    try {
      const res = await fetch("/api/agents/library");
      const data = await res.json();
      const templates: LibraryTemplate[] = data.templates ?? [];
      setLibraryTemplates(templates);
      const checked = computeChecked(answers);
      setSuggestedAgents(
        templates.map((t) => ({
          slug: t.slug,
          name: t.name,
          emoji: t.emoji,
          role: t.role,
          checked: checked.has(t.slug),
        }))
      );
    } catch {
      // Fallback: at least offer Research Director + Editor
      setSuggestedAgents([
        { slug: "ceo", name: "Research Director", emoji: "🔬", role: "Research strategy, goal tracking, team coordination", checked: true },
        { slug: "editor", name: "Editor", emoji: "\u{1F4DD}", role: "KB content, documentation, formatting", checked: true },
      ]);
    } finally {
      setAgentsLoading(false);
    }
  };

  const MAX_AGENTS = 5;

  const toggleAgent = (slug: string) => {
    // Research Director and Editor are mandatory — cannot be unchecked
    if (ALWAYS_CHECKED.has(slug)) return;

    setSuggestedAgents((prev) => {
      const target = prev.find((a) => a.slug === slug);
      if (!target) return prev;

      // If trying to check and already at limit, block it
      if (!target.checked && prev.filter((a) => a.checked).length >= MAX_AGENTS) {
        return prev;
      }

      return prev.map((a) =>
        a.slug === slug ? { ...a, checked: !a.checked } : a
      );
    });
  };

  const launch = useCallback(async () => {
    setLaunching(true);
    try {
      const selected = suggestedAgents.filter((a) => a.checked).map((a) => a.slug);

      // Save provider + model preference
      if (selectedProvider) {
        await fetch("/api/agents/providers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defaultProvider: selectedProvider,
            defaultModel: selectedModel || undefined,
            defaultEffort: selectedEffort || undefined,
          }),
        });
      }

      await fetch("/api/onboarding/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          selectedAgents: selected,
        }),
      });

      onComplete();
    } catch (e) {
      console.error("Setup failed:", e);
      setLaunching(false);
    }
  }, [answers, suggestedAgents, selectedProvider, selectedModel, selectedEffort, onComplete]);

  const selectedAgentCount = suggestedAgents.filter(
    (agent) => agent.checked
  ).length;
  const launchDisabled = launching || selectedAgentCount === 0;

  /* ─── Shared inline styles (website tokens) ─── */
  const inputStyle: React.CSSProperties = {
    background: WEB.bgCard,
    border: `1px solid ${WEB.border}`,
    color: WEB.text,
    borderRadius: 12,
    height: 44,
    fontSize: 15,
    padding: "0 14px",
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
  };

  return (
    <div className="min-h-screen relative" style={{ background: WEB.bg, color: WEB.text }}>
      {/* Built-on notice */}
      <a
        href={RUNCABINET_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
        style={{ background: WEB.bgCard, border: `1px solid ${WEB.border}`, color: WEB.textTertiary }}
      >
        built on runcabinet
        <ExternalLink className="size-2.5" />
      </a>
      <div
        className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-10"
        style={dotGridStyle}
      >
        <div className="w-full">
          {/* Progress indicator */}
          <div className="mb-10 flex items-center justify-center gap-2">
            {Array.from({ length: STEP_COUNT }, (_, i) => i).map((i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  height: 8,
                  width: i <= step ? 40 : 24,
                  background: i <= step ? WEB.accent : WEB.borderLight,
                }}
              />
            ))}
          </div>

          {/* Step 0: Welcome — Dictionary card */}
          {step === 0 && (
            <IntroStep onNext={() => setStep(1)} />
          )}

          {/* Step 1: Welcome — About you */}
          {step === 1 && (
            <div className="mx-auto flex max-w-xl flex-col gap-8 ">
              <div className="text-center space-y-2">
                <h1 className="font-logo text-2xl tracking-tight italic">
                  Welcome to <span style={{ color: WEB.accent }}>your</span> Cabinet
                </h1>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: WEB.text }}>
                    What&apos;s your name?
                  </label>
                  <input
                    value={answers.name}
                    onChange={(e) =>
                      setAnswers({ ...answers, name: e.target.value })
                    }
                    placeholder="Jane"
                    style={inputStyle}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: WEB.text }}>
                    What&apos;s your lab or research group name?
                  </label>
                  <input
                    value={answers.companyName}
                    onChange={(e) =>
                      setAnswers({ ...answers, companyName: e.target.value })
                    }
                    placeholder="Smith Lab"
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: WEB.text }}>
                    What do you do?
                  </label>
                  <input
                    value={answers.description}
                    onChange={(e) =>
                      setAnswers({ ...answers, description: e.target.value })
                    }
                    placeholder="We study neural circuits in model organisms"
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: WEB.text }}>
                    How big is your team?
                  </label>
                  <div className="flex gap-2">
                    {TEAM_SIZES.map((size) => (
                      <button
                        key={size}
                        onClick={() =>
                          setAnswers({ ...answers, teamSize: size })
                        }
                        className="flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all"
                        style={{
                          border: `1px solid ${answers.teamSize === size ? WEB.accent : WEB.border}`,
                          background: answers.teamSize === size ? WEB.accentBg : WEB.bgCard,
                          color: answers.teamSize === size ? WEB.accent : WEB.textSecondary,
                        }}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                      style={{
                        color: WEB.textSecondary,
                        background: `${WEB.bg}`,
                        border: `1px solid ${WEB.border}`,
                      }}
                    >
                      Coming soon
                    </span>
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: WEB.textTertiary }}
                    >
                      Pre-made multi-human multi-agent teams
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep(0)}
                  className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors"
                  style={{ color: WEB.textSecondary }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
                  onClick={goToTeamSuggestion}
                  disabled={!answers.name.trim() || !answers.companyName.trim()}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
                  style={{ background: WEB.accent }}
                >
                  Next
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Team Suggestion — carousel + agent picker */}
          {step === 2 && (
            <TeamBuildStep
              agentsLoading={agentsLoading}
              suggestedAgents={suggestedAgents}
              libraryTemplates={libraryTemplates}
              launchDisabled={launchDisabled}
              selectedCount={selectedAgentCount}
              maxAgents={MAX_AGENTS}
              toggleAgent={toggleAgent}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {/* Step 3: AI Provider Check */}
          {step === 3 && (
            <div className="mx-auto flex max-w-xl flex-col gap-6 ">
              <div className="text-center space-y-2">
                <h1 className="font-logo text-2xl tracking-tight italic">
                  Agent Provider
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: WEB.textSecondary }}>
                  Cabinet needs an AI CLI to power your agents.
                </p>
              </div>

              {/* Registered CLI providers */}
              {providersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-6 animate-spin" style={{ color: WEB.textTertiary }} />
                </div>
              ) : (
                <div className="space-y-3">
                  {providers.map((p) => {
                    const isReady = !!(p.available && p.authenticated);
                    const isInstalled = !!p.available;
                    const isExpanded = expandedProvider === p.id;
                    const isSelected = selectedProvider === p.id;
                    const statusColor = isReady ? "#16a34a" : isInstalled ? "#d97706" : WEB.textTertiary;
                    const statusText = isReady
                      ? `Ready ${p.version ? `\u2014 ${p.version}` : ""}`
                      : isInstalled
                        ? "Installed but not logged in"
                        : "Not detected on this machine";
                    const setupSteps: { title: string; detail: string; cmd?: string; openTerminal?: boolean; link?: { label: string; url: string } }[] = [
                      { title: "Open a terminal", detail: "You'll need a terminal to run the next steps.", openTerminal: true },
                      ...((p.installSteps || []).map((step) => {
                        return {
                          title: step.title,
                          detail: step.detail,
                          cmd: step.command,
                          link: step.link,
                        };
                      })),
                    ];
                    return (
                      <div
                        key={p.id}
                        className="group rounded-xl p-4 space-y-3 transition-all cursor-pointer"
                        style={{
                          background: isSelected && isReady ? WEB.accentBg : WEB.bgCard,
                          border: `1px solid ${isSelected && isReady ? WEB.borderDark : WEB.borderLight}`,
                        }}
                        onClick={() => {
                          if (!isReady) return;
                          const nextModelId = p.models?.[0]?.id ?? null;
                          setSelectedProvider(p.id);
                          setSelectedModel(nextModelId);
                          setSelectedEffort(
                            getSuggestedProviderEffort(
                              p,
                              nextModelId || undefined
                            )?.id || null
                          );
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Radio selector for ready providers */}
                          {isReady && (
                            <div
                              className="flex size-4 shrink-0 items-center justify-center rounded-full"
                              style={{
                                border: `1.5px solid ${isSelected ? WEB.accent : WEB.borderDark}`,
                                background: isSelected ? WEB.accent : "transparent",
                              }}
                            >
                              {isSelected && <Check className="size-2.5 text-white" />}
                            </div>
                          )}
                          <div
                            className="flex size-9 items-center justify-center rounded-lg"
                            style={{ background: WEB.bgWarm, color: WEB.accent }}
                          >
                            <ProviderGlyph icon={p.icon} className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: WEB.text }}>
                              {p.name}
                            </p>
                            <p className="text-[11px]" style={{ color: statusColor }}>
                              {statusText}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedProvider(isExpanded ? null : p.id); }}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                              style={{
                                background: isExpanded ? WEB.bgWarm : "transparent",
                                color: WEB.textTertiary,
                              }}
                            >
                              <Info className="size-3" />
                              Guide
                              <ChevronDown
                                className="size-3 transition-transform duration-300"
                                style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
                              />
                            </button>
                            {isReady && (
                              <CheckCircle2 className="size-5" style={{ color: "#16a34a" }} />
                            )}
                            {isInstalled && !isReady && (
                              <XCircle className="size-5" style={{ color: "#d97706" }} />
                            )}
                            {!isInstalled && (
                              <XCircle className="size-5" style={{ color: WEB.textTertiary }} />
                            )}
                          </div>
                        </div>

                        <div
                          className="overflow-hidden transition-all duration-300 ease-in-out"
                          style={{
                            maxHeight: isExpanded ? 500 : 0,
                            opacity: isExpanded ? 1 : 0,
                          }}
                        >
                          <div
                            className="rounded-lg p-3 space-y-3"
                            style={{ background: WEB.bgWarm }}
                          >
                            {setupSteps.map((setupStep, i) => (
                              <div key={i} className="flex items-start gap-2.5">
                                <span
                                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5"
                                  style={{ background: WEB.accent, color: "white" }}
                                >
                                  {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-medium" style={{ color: WEB.text }}>
                                    {setupStep.title}
                                  </p>
                                  <p className="text-[11px] mt-0.5" style={{ color: WEB.textSecondary }}>
                                    {setupStep.detail}
                                  </p>
                                  {setupStep.cmd && (
                                    <TerminalCommand command={setupStep.cmd} />
                                  )}
                                  {setupStep.openTerminal && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        fetch("/api/terminal/open", { method: "POST" }).catch(() => {
                                          alert("Could not open terminal automatically. Please open Terminal.app (Mac) or your system terminal manually.");
                                        });
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 mt-1.5 text-[11px] font-medium transition-all hover:-translate-y-0.5"
                                      style={{ background: "#1e1e1e", color: "#d4d4d4" }}
                                    >
                                      <Terminal className="size-3" />
                                      Open terminal
                                    </button>
                                  )}
                                  {setupStep.link && (
                                    <a
                                      href={setupStep.link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-[11px] font-medium mt-1.5"
                                      style={{ color: WEB.accent }}
                                    >
                                      {setupStep.link.label}
                                      <ExternalLink className="size-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}

                            <p className="text-[11px]" style={{ color: WEB.textTertiary }}>
                              After setup, click Re-check below. You may need to restart Cabinet if it was already running.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={checkProvider}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all hover:-translate-y-0.5"
                    style={{ background: WEB.bgWarm, border: `1px solid ${WEB.borderLight}`, color: WEB.accent }}
                  >
                    <RefreshCw className="size-3" />
                    Re-check providers
                  </button>
                </div>
              )}

              {/* Model selector — shown when a ready provider is selected */}
              {activeModels.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: WEB.textTertiary }}>
                    Default model
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {activeModels.map((m) => {
                      const isMSelected = selectedModel === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            const nextEffortId =
                              resolveProviderEffort(
                                activeProvider,
                                m.id,
                                selectedEffort || undefined,
                                undefined
                              )?.id ||
                              getSuggestedProviderEffort(activeProvider, m.id)?.id ||
                              null;
                            setSelectedModel(m.id);
                            setSelectedEffort(nextEffortId);
                          }}
                          className="rounded-xl p-3 text-left transition-all"
                          style={{
                            background: isMSelected ? WEB.accentBg : WEB.bgCard,
                            border: `1px solid ${isMSelected ? WEB.borderDark : WEB.borderLight}`,
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="flex size-3 shrink-0 items-center justify-center rounded-full"
                              style={{
                                border: `1.5px solid ${isMSelected ? WEB.accent : WEB.borderDark}`,
                                background: isMSelected ? WEB.accent : "transparent",
                              }}
                            >
                              {isMSelected && <Check className="size-1.5 text-white" />}
                            </div>
                            <p className="text-[13px] font-medium" style={{ color: WEB.text }}>{m.name}</p>
                          </div>
                          {m.description && (
                            <p className="text-[11px] ml-5" style={{ color: WEB.textSecondary }}>{m.description}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Effort level selector — only for providers that support it */}
              {activeEffortLevels.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: WEB.textTertiary }}>
                    {activeModel?.name
                      ? `Reasoning effort · ${activeModel.name}`
                      : "Reasoning effort"}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {activeEffortLevels.map((e) => {
                      const isESelected = selectedEffort === e.id;
                      return (
                        <button
                          key={e.id}
                          onClick={() => setSelectedEffort(e.id)}
                          className="rounded-xl p-3 text-left transition-all"
                          style={{
                            background: isESelected ? WEB.accentBg : WEB.bgCard,
                            border: `1px solid ${isESelected ? WEB.borderDark : WEB.borderLight}`,
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="flex size-3 shrink-0 items-center justify-center rounded-full"
                              style={{
                                border: `1.5px solid ${isESelected ? WEB.accent : WEB.borderDark}`,
                                background: isESelected ? WEB.accent : "transparent",
                              }}
                            >
                              {isESelected && <Check className="size-1.5 text-white" />}
                            </div>
                            <p className="text-[13px] font-medium" style={{ color: WEB.text }}>{e.name}</p>
                          </div>
                          {e.description && (
                            <p className="text-[11px] ml-5" style={{ color: WEB.textSecondary }}>{e.description}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Coming soon providers */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: WEB.textTertiary }}>
                  Coming soon
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { name: "Gemini CLI", type: "CLI", icon: "terminal" },
                    { name: "Anthropic API", type: "API", icon: "api" },
                    { name: "OpenAI API", type: "API", icon: "api" },
                    { name: "Google AI API", type: "API", icon: "api" },
                  ].map((p) => (
                    <div
                      key={p.name}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 opacity-40"
                      style={{
                        background: WEB.bgCard,
                        border: `1px solid ${WEB.borderLight}`,
                      }}
                    >
                      <div
                        className="flex size-8 items-center justify-center rounded-lg"
                        style={{ background: WEB.bgWarm, color: WEB.textTertiary }}
                      >
                        {p.icon === "terminal" ? (
                          <Terminal className="size-4" />
                        ) : (
                          <Zap className="size-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium" style={{ color: WEB.textSecondary }}>
                          {p.name}
                        </p>
                        <p className="text-[10px]" style={{ color: WEB.textTertiary }}>
                          {p.type} agent
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors"
                  style={{ color: WEB.textSecondary }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
                  onClick={() => setStep(LAUNCH_STEP)}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5"
                  style={{ background: WEB.accent }}
                >
                  {anyProviderReady ? "Next" : "Skip for now"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}


          {/* Step 4: Launch — Summary + data directory */}
          {step === LAUNCH_STEP && (
            <div className="mx-auto flex max-w-4xl flex-col gap-6 ">
              <div className="text-center space-y-2">
                <h1 className="font-logo text-2xl tracking-tight italic">
                  Launch your <span style={{ color: WEB.accent }}>Research Cabinet</span>
                </h1>
              </div>

              <div
                className="rounded-2xl overflow-hidden flex flex-col lg:flex-row lg:h-[280px]"
                style={{
                  background: WEB.bgCard,
                  border: `1px solid ${WEB.border}`,
                  boxShadow: "0 1px 3px rgba(59, 47, 47, 0.04), 0 8px 30px rgba(59, 47, 47, 0.04)",
                }}
              >
                {/* Left half — Company + agents */}
                <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                  <div className="space-y-1">
                    <h2 className="font-logo text-xl tracking-tight italic" style={{ color: WEB.text }}>
                      {answers.companyName || "Your Cabinet"}
                    </h2>
                    <p
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: WEB.textTertiary }}
                    >
                      {answers.description || "Knowledge base + AI team"}
                    </p>
                  </div>

                  <div
                    className="h-px w-full"
                    style={{ background: WEB.borderLight }}
                  />

                  <div className="flex flex-col gap-1">
                    {suggestedAgents.filter((a) => a.checked).map((a) => (
                      <div
                        key={a.slug}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                        style={{ background: WEB.bgWarm }}
                      >
                        <span className="text-sm">{a.emoji}</span>
                        <p className="text-[12px] font-medium flex-1" style={{ color: WEB.text }}>
                          {a.name}
                        </p>
                        <span className="relative flex size-2.5">
                          <span
                            className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
                            style={{ background: "#22c55e" }}
                          />
                          <span
                            className="relative inline-flex size-2.5 rounded-full"
                            style={{ background: "#22c55e" }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right half — Animated agent chat preview */}
                <div
                  className="relative flex-1 flex flex-col overflow-hidden"
                  style={{ background: WEB.bgWarm, borderLeft: `1px solid ${WEB.borderLight}` }}
                >
                  {/* Channel header */}
                  <div
                    className="shrink-0 px-4 py-2 flex items-center gap-2"
                    style={{ background: WEB.bgWarm, borderBottom: `1px solid ${WEB.borderLight}` }}
                  >
                    <span className="text-[11px] font-semibold" style={{ color: WEB.textTertiary }}>#</span>
                    <span className="text-[11px] font-semibold" style={{ color: WEB.text }}>general</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 pb-2 space-y-0.5">
                    <AgentChatPreview agents={suggestedAgents.filter((a) => a.checked)} companyName={answers.companyName} />
                  </div>
                </div>
              </div>


              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors"
                  style={{ color: WEB.textSecondary }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
                  onClick={launch}
                  disabled={launchDisabled}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
                  style={{ background: WEB.accent }}
                >
                  {launching ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" />
                      Launch Cabinet
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

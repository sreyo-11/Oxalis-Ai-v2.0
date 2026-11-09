import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Terminal,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
const POLL_INTERVAL = 1500;

/* Design tokens (Tailwind arbitrary values reference these literals):
    paper  #F7F7F7   ink  #111111   accent  #DF4118   */

const AGENTS = [
  { key: "planner", label: "PLANNER", n: "01" },
  { key: "retriev", label: "RETRIEVER+RAG", n: "02" },
  { key: "executor", label: "EXECUTOR", n: "03" },
];

const TICKS = 50;

const STATUS_LABEL = {
  idle: "IDLE",
  running: "RUNNING",
  done: "COMPLETE",
  error: "FAULT",
};

/* -------------------------------------------------------------------------- */
/*  Global CSS (grid background + a few lightweight keyframes)                */
/* -------------------------------------------------------------------------- */

const GLOBAL_CSS = `
@keyframes iso-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes iso-flow { to { stroke-dashoffset: -24; } }
@keyframes iso-blip { 0%, 49% { opacity: 1; } 50%, 100% { opacity: .2; } }

.iso-float { animation: iso-float 1.8s ease-in-out infinite; }
.iso-flow { stroke-dasharray: 6 6; animation: iso-flow .9s linear infinite; }
.iso-blip { animation: iso-blip 1s steps(1) infinite; }

.blueprint-grid {
  background-color: #F7F7F7;
  background-image:
    linear-gradient(rgba(17,17,17,.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(17,17,17,.045) 1px, transparent 1px),
    linear-gradient(rgba(17,17,17,.09) 1px, transparent 1px),
    linear-gradient(90deg, rgba(17,17,17,.09) 1px, transparent 1px);
  background-size: 24px 24px, 24px 24px, 120px 120px, 120px 120px;
}

@media (prefers-reduced-motion: reduce) {
  .iso-float, .iso-flow, .iso-blip { animation: none !important; }
}
`;

/* -------------------------------------------------------------------------- */
/*  Shared style tokens                                                       */
/* -------------------------------------------------------------------------- */

const fieldClasses =
  "w-full rounded-none border border-[#111] bg-white px-3 py-3 font-mono text-[13px] text-[#111] placeholder-[#777] outline-none transition-all duration-150 hover:bg-[#FAFAFA] focus:shadow-[3px_3px_0_0_#DF4118] focus:border-[#111]";

const labelClasses =
  "mb-2 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#111] font-bold";

const MARKDOWN_CLASSES = [
  "text-[14px] leading-7 text-[#111]",
  "[&_h1]:mt-0 [&_h1]:mb-5 [&_h1]:text-4xl [&_h1]:font-black [&_h1]:uppercase [&_h1]:leading-[0.95] [&_h1]:tracking-tighter [&_h1]:text-[#111]",
  "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:border-b-2 [&_h2]:border-[#111] [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:uppercase [&_h2]:tracking-tight [&_h2]:text-[#111]",
  "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-[#111]",
  "[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:font-mono [&_h4]:text-xs [&_h4]:font-bold [&_h4]:uppercase [&_h4]:tracking-[0.18em] [&_h4]:text-[#111]",
  "[&_p]:my-4 [&_p]:text-[#111]",
  "[&_a]:text-[#DF4118] [&_a]:underline [&_a]:decoration-[#DF4118]/40 [&_a]:underline-offset-4 hover:[&_a]:decoration-[#DF4118]",
  "[&_strong]:font-bold [&_strong]:text-[#111]",
  "[&_ul]:my-4 [&_ul]:list-none [&_ul]:pl-0 [&_ul>li]:relative [&_ul>li]:my-1.5 [&_ul>li]:pl-5 [&_ul>li]:text-[#111] [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-[0.6em] [&_ul>li]:before:h-1.5 [&_ul>li]:before:w-1.5 [&_ul>li]:before:bg-[#DF4118] [&_ul>li]:before:content-['']",
  "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:marker:font-mono [&_ol]:marker:text-[#DF4118] [&_ol>li]:my-1.5 [&_ol>li]:text-[#111]",
  "[&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-[#DF4118] [&_blockquote]:bg-white [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-[#111]",
  "[&_hr]:my-8 [&_hr]:border-[#111]/30",
  "[&_code]:border [&_code]:border-[#111]/20 [&_code]:bg-[#F1F1F1] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:text-[#111]",
  "[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-[#111] [&_pre]:bg-[#FAFAFA] [&_pre]:p-4 [&_pre]:shadow-[3px_3px_0_0_#111]",
  "[&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[#111]",
  "[&_table]:my-6 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm",
  "[&_th]:border [&_th]:border-[#111] [&_th]:bg-[#111] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-mono [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-white",
  "[&_td]:border [&_td]:border-[#111]/30 [&_td]:bg-white [&_td]:px-3 [&_td]:py-2 [&_td]:text-[#111]",
].join(" ");

/* -------------------------------------------------------------------------- */
/*  Isometric SVG primitives                                                  */
/* -------------------------------------------------------------------------- */

const COS30 = 0.866;

const CUBE_FILL = {
  idle: { top: "#FFFFFF", left: "#EFEFEF", right: "#D9D9D9" },
  active: { top: "#DF4118", left: "#FFFFFF", right: "#111111" },
  done: { top: "#111111", left: "#FFFFFF", right: "#E2E2E2" },
};

/** Isometric cube with its centre vertex at (0,0). Side length = a. */
function IsoCube({ a, state }) {
  const f = CUBE_FILL[state];
  const w = a * COS30;
  const h = a * 0.5;
  const top = `0,${-a} ${w},${-h} 0,0 ${-w},${-h}`;
  const left = `${-w},${-h} 0,0 0,${a} ${-w},${h}`;
  const right = `0,0 ${w},${-h} ${w},${h} 0,${a}`;
  return (
    <g stroke="#111" strokeWidth="1.5" strokeLinejoin="round">
      <polygon points={left} fill={f.left} />
      <polygon points={right} fill={f.right} />
      <polygon points={top} fill={f.top} />
    </g>
  );
}

/** Flat isometric platform (diamond) centred on the cube's base. */
function IsoPlatform({ a }) {
  const cy = a * 0.5;
  const hw = a * COS30 * 1.35;
  const hh = a * 0.5 * 1.35;
  return (
    <polygon
      points={`0,${cy - hh} ${hw},${cy} 0,${cy + hh} ${-hw},${cy}`}
      fill="#FFFFFF"
      stroke="#111"
      strokeWidth="1"
      strokeDasharray="3 3"
    />
  );
}

const NODES = [
  { x: 110, y: 105 },
  { x: 280, y: 185 },
  { x: 450, y: 105 },
];
const CUBE = 32;

function PipelineFigure({ status, stage }) {
  const running = status === "running";
  const done = status === "done";
  const stageLower = String(stage || "").toLowerCase();
  const activeIdx = AGENTS.findIndex((a) => stageLower.includes(a.key));

  const nodeState = (i) => {
    if (done) return "done";
    if (!running || activeIdx === -1) return "idle";
    if (i < activeIdx) return "done";
    if (i === activeIdx) return "active";
    return "idle";
  };

  const baseY = CUBE * 0.5;
  const pathD = NODES.map((n, i) => `${i === 0 ? "M" : "L"}${n.x},${n.y + baseY}`).join(" ");

  return (
    <svg
      viewBox="0 0 560 290"
      className="block h-auto w-full"
      role="img"
      aria-label="Agent pipeline: Planner, Retriever, Executor"
    >
      <defs>
        <pattern id="isoGrid" width="52" height="30" patternUnits="userSpaceOnUse">
          <path
            d="M0 15 L26 0 M26 0 L52 15 M0 15 L26 30 M26 30 L52 15"
            fill="none"
            stroke="#111"
            strokeOpacity="0.18"
            strokeWidth="1"
          />
        </pattern>
        <radialGradient id="isoFade" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="isoMask">
          <rect width="560" height="290" fill="url(#isoFade)" />
        </mask>
      </defs>

      {/* Isometric floor grid */}
      <rect width="560" height="290" fill="url(#isoGrid)" mask="url(#isoMask)" />

      {/* Registration marks */}
      <g stroke="#111" strokeWidth="1" fill="none">
        <path d="M8 22V8H22" />
        <path d="M538 8H552V22" />
        <path d="M8 268V282H22" />
        <path d="M552 268V282H538" />
      </g>

      {/* Connectors */}
      {NODES.slice(0, -1).map((n, i) => {
        const m = NODES[i + 1];
        const st = nodeState(i);
        const props =
          st === "done"
            ? { stroke: "#111", strokeWidth: 1.5 }
            : st === "active"
            ? { stroke: "#DF4118", strokeWidth: 2, className: "iso-flow" }
            : { stroke: "#888", strokeWidth: 1.5, strokeDasharray: "4 5" };
        return (
          <line
            key={i}
            x1={n.x}
            y1={n.y + baseY}
            x2={m.x}
            y2={m.y + baseY}
            {...props}
          />
        );
      })}

      {/* Data packet travelling the pipeline */}
      {running && (
        <rect x="-4" y="-4" width="8" height="8" fill="#DF4118" stroke="#111" strokeWidth="1" transform="rotate(45)">
          <animateMotion dur="3.2s" repeatCount="indefinite" path={pathD} rotate="0" />
        </rect>
      )}

      {/* Nodes */}
      {NODES.map((n, i) => {
        const st = nodeState(i);
        const agent = AGENTS[i];
        return (
          <g key={agent.key} transform={`translate(${n.x} ${n.y})`}>
            <IsoPlatform a={CUBE} />
            <g className={st === "active" ? "iso-float" : ""}>
              <IsoCube a={CUBE} state={st} />
            </g>
            <text
              x="0"
              y={CUBE * 1.25 + 24}
              textAnchor="middle"
              fontSize="10"
              letterSpacing="1.6"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
              fill="#111"
              fontWeight="700"
            >
              {agent.n} {agent.label}
            </text>
            <text
              x="0"
              y={CUBE * 1.25 + 38}
              textAnchor="middle"
              fontSize="9"
              letterSpacing="1.6"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
              fill={st === "active" ? "#DF4118" : "#555"}
            >
              {st === "done" ? "DONE" : st === "active" ? "ACTIVE" : "IDLE"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Small isometric wireframe cube for empty states. */
function WireCube({ size = 44 }) {
  const a = size / 2;
  const w = a * COS30;
  const h = a * 0.5;
  return (
    <svg width={size * 1.8} height={size * 1.4} viewBox={`${-w - 2} ${-a - 2} ${2 * w + 4} ${2 * a + 4}`} fill="none" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" aria-hidden="true">
      <polygon points={`0,${-a} ${w},${-h} ${w},${h} 0,${a} ${-w},${h} ${-w},${-h}`} />
      <polyline points={`${-w},${-h} 0,0 ${w},${-h}`} />
      <line x1="0" y1="0" x2="0" y2={a} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Layout primitives                                                         */
/* -------------------------------------------------------------------------- */

function FigStrip({ n, title, right }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#111] bg-white px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em]">
      <span className="flex items-center gap-3">
        <span className="bg-[#111] px-1.5 py-0.5 text-white">{n}</span>
        <span className="text-[#111]">{title}</span>
      </span>
      {right}
    </div>
  );
}

function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`group inline-flex cursor-pointer items-center justify-center gap-3 border border-[#111] bg-[#111] px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-white shadow-[4px_4px_0_0_#DF4118] transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[#DF4118] hover:shadow-[6px_6px_0_0_#111] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DF4118] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F7F7] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:border-[#aaa] disabled:bg-[#ddd] disabled:text-[#666] disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0 ${className}`}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sections                                                                  */
/* -------------------------------------------------------------------------- */

function TopBar({ status }) {
  const running = status === "running";
  return (
    <header className="sticky top-0 z-50 border-b border-[#111] bg-[#F7F7F7]/90 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="text-base leading-none">☘️</span>
          <span className="text-sm font-black uppercase tracking-tighter text-[#111]">Oxalis AI</span>
          <span className="hidden h-4 w-px bg-[#111]/30 sm:block"></span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-[#111] sm:block">
            Strategy swarm / RAG engine
          </span>
        </div>
        <div className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.2em]">
          <span className="hidden items-center gap-2 text-[#111] sm:flex">
            <span className="h-1.5 w-1.5 bg-[#111]"></span>
            Vector RAG online
          </span>
          <span className="flex items-center gap-2 border border-[#111] bg-white px-2 py-1 text-[#111]">
            <span className={`h-1.5 w-1.5 ${running ? "iso-blip bg-[#DF4118]" : status === "error" ? "bg-[#DF4118]" : "bg-[#111]"}`}></span>
            {STATUS_LABEL[status] || "IDLE"}
          </span>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <div className="pb-10 pt-12 sm:pb-14 sm:pt-20">
      <h1 className="text-[clamp(3.25rem,11vw,8.5rem)] font-black uppercase leading-[0.86] tracking-tighter text-[#111]">
        Blueprint
        <br />
        <span className="text-transparent [-webkit-text-stroke:2px_#111]">Generator</span>
        <span className="text-[#DF4118]">.</span>
      </h1>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#111]">
        <span>Planner</span>
        <span className="text-[#111]/40">→</span>
        <span>Retriever + RAG</span>
        <span className="text-[#111]/40">→</span>
        <span>Executor</span>
      </div>
    </div>
  );
}

function ParametersCell({
  topic, setTopic, timeframe, setTimeframe, context, setContext, status, stage, onSubmit,
}) {
  const running = status === "running";
  return (
    <div className="flex flex-col">
      <FigStrip n="01" title="Parameters" />
      <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-6 p-5 sm:p-6">
        <div>
          <label className={labelClasses}>
            <span className="text-[#DF4118] font-bold">A.</span> Project goal / topic
          </label>
          <input
            type="text"
            required
            minLength={3}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Real-time collaborative code editor, WebSockets"
            className={fieldClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>
            <span className="text-[#DF4118] font-bold">B.</span> Execution timeframe
          </label>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className={`${fieldClasses} cursor-pointer`}
          >
            <option>Short Analysis</option>
            <option>1 Week Phase</option>
            <option>1 Month Phase</option>
            <option>1 Year Phase</option>
            <option>Longer than a year</option>
          </select>
        </div>

        <div>
          <label className={labelClasses}>
            <span className="text-[#DF4118] font-bold">C.</span> Constraints / tech stack
          </label>
          <input
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Serverless only, zero cost budget"
            className={fieldClasses}
          />
        </div>

        <div className="mt-auto pt-2">
          <PrimaryButton type="submit" disabled={running} className="w-full">
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Running // {stage}</span>
              </>
            ) : (
              <>
                <span>Generate blueprint</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
              </>
            )}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

function PipelineCell({ status, stage }) {
  return (
    <div className="flex flex-col border-t border-[#111] lg:border-l lg:border-t-0">
      <FigStrip
        n="02"
        title="Agent pipeline"
        right={<span className="text-[#111] font-bold">{STATUS_LABEL[status] || "IDLE"}</span>}
      />
      <div className="flex flex-1 items-center p-4 sm:p-6">
        <PipelineFigure status={status} stage={stage} />
      </div>
      <div className="flex items-center gap-5 border-t border-[#111]/20 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#111]">
        <span className="flex items-center gap-2"><span className="h-2 w-2 border border-[#111] bg-white"></span>Idle</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 border border-[#111] bg-[#DF4118]"></span>Active</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 border border-[#111] bg-[#111]"></span>Done</span>
      </div>
    </div>
  );
}

function TelemetryCell({ status, stage, progress, logs, jobId, logsEndRef }) {
  const running = status === "running";
  const done = status === "done";
  const pct = done ? 100 : Math.round(Math.min(Math.max(progress, 0), 1) * 100);
  const filled = Math.round((pct / 100) * TICKS);

  return (
    <div className="border-t border-[#111]">
      <FigStrip
        n="03"
        title="Telemetry"
        right={
          <span className="hidden text-[#111] sm:inline">
            Job {jobId ? String(jobId).slice(0, 8) : "--------"} · {String(logs.length).padStart(3, "0")} lines
          </span>
        }
      />
      <div className="grid lg:grid-cols-12">
        <div className="flex flex-col justify-between gap-6 p-5 sm:p-6 lg:col-span-5">
          <div className="flex items-end justify-between gap-4">
            <div
              className={`text-7xl font-black leading-none tracking-tighter tabular-nums transition-colors duration-300 sm:text-8xl ${
                running ? "text-[#DF4118]" : "text-[#111]"
              }`}
            >
              {String(pct).padStart(3, "0")}
              <span className="text-3xl sm:text-4xl">%</span>
            </div>
            <div className="pb-1 text-right font-mono text-[10px] uppercase leading-5 tracking-[0.2em] text-[#111]">
              <div>Stage</div>
              <div className="text-xs font-bold text-[#111]">
                {running ? stage : done ? "Complete" : status === "error" ? "Fault" : "Standby"}
              </div>
            </div>
          </div>

          {/* Ruler progress */}
          <div
            className="flex h-4 items-end gap-[2px]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            {Array.from({ length: TICKS }).map((_, i) => {
              const tall = i % 10 === 0 ? "h-4" : i % 5 === 0 ? "h-3" : "h-2";
              const on = i < filled;
              const live = running && i === filled - 1;
              return (
                <span
                  key={i}
                  className={`w-px flex-1 transition-colors duration-200 ${tall} ${
                    live ? "bg-[#DF4118]" : on ? "bg-[#111]" : "bg-[#111]/20"
                  }`}
                />
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#111] lg:col-span-7 lg:border-l lg:border-t-0">
          <div className="h-52 space-y-1 overflow-y-auto bg-[#FAFAFA] p-4 font-mono text-[11px] leading-relaxed text-[#111]">
            {logs.length === 0 && <div className="text-[#666]">-- no data --</div>}
            {logs.map((log, index) => (
              <div key={index} className="flex gap-3">
                <span className="select-none text-[#DF4118] font-bold">{String(index + 1).padStart(2, "0")}</span>
                <span className="break-words">{log}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

function OutputViewport({ status, stage, result, logs, activeTab, setActiveTab, onDownload }) {
  const running = status === "running";

  const tabClasses = (name) =>
    `relative -mb-px flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors duration-150 focus:outline-none focus-visible:text-[#DF4118] ${
      activeTab === name
        ? "border-[#DF4118] text-[#111] font-bold"
        : "border-transparent text-[#555] hover:border-[#111]/40 hover:text-[#111]"
    }`;

  return (
    <section className="border border-[#111] bg-white shadow-[8px_8px_0_0_#111]">
      <FigStrip
        n="04"
        title="Blueprint output"
        right={
          result ? (
            <span className="hidden items-center gap-1.5 text-[#111] font-bold sm:flex">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#DF4118]" />
              Compiled
            </span>
          ) : null
        }
      />

      <div className="flex items-center justify-between gap-3 border-b border-[#111]/20 px-3 sm:px-4">
        <div className="flex gap-2">
          <button onClick={() => setActiveTab("blueprint")} className={tabClasses("blueprint")}>
            <FileText className="h-3.5 w-3.5" />
            <span>Blueprint</span>
          </button>
          <button onClick={() => setActiveTab("logs")} className={tabClasses("logs")}>
            <Terminal className="h-3.5 w-3.5" />
            <span>Agent logs</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onDownload}
          disabled={!result}
          className="group my-2 flex cursor-pointer items-center gap-2 border border-[#111] bg-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#111] shadow-[2px_2px_0_0_#111] transition-all duration-150 hover:-translate-x-px hover:-translate-y-px hover:bg-[#DF4118] hover:text-white hover:shadow-[3px_3px_0_0_#111] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DF4118] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:border-[#ccc] disabled:text-[#888] disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:bg-white disabled:hover:text-[#888]"
        >
          <Download className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-y-0.5 group-disabled:translate-y-0" />
          <span>Export .md</span>
        </button>
      </div>

      <div className="min-h-[24rem] p-5 sm:p-8">
        {activeTab === "logs" ? (
          <div className="space-y-1 border border-[#111]/20 bg-[#FAFAFA] p-4 font-mono text-xs leading-relaxed text-[#111]">
            {logs.length === 0 && <div className="text-[#666]">-- no data --</div>}
            {logs.map((log, index) => (
              <div key={index} className="flex gap-3">
                <span className="select-none text-[#DF4118] font-bold">{String(index + 1).padStart(3, "0")}</span>
                <span className="break-words">{log}</span>
              </div>
            ))}
          </div>
        ) : result ? (
          <article className={`markdown-content max-w-3xl ${MARKDOWN_CLASSES}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
          </article>
        ) : (
          <div className="flex min-h-[20rem] flex-col items-center justify-center gap-5 text-center">
            <div className={running ? "iso-float" : ""}>
              <WireCube />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#333] font-bold">
              {running ? (
                <>
                  Generating // {stage}
                  <span className="iso-blip ml-1 inline-block h-3 w-1.5 translate-y-0.5 bg-[#DF4118]"></span>
                </>
              ) : (
                "No output"
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#111]">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[#111] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>Oxalis AI</span>
        <span className="truncate normal-case tracking-normal">{BACKEND_URL}</span>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/*  App                                                                       */
/* -------------------------------------------------------------------------- */

export default function App() {
  const [topic, setTopic] = useState("");
  const [timeframe, setTimeframe] = useState("1 Month Phase");
  const [context, setContext] = useState("");

  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, running, done, error
  const [stage, setStage] = useState("Queued");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState("blueprint");

  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [logs]);

  useEffect(() => {
    if (!jobId || status !== "running") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/plan/${jobId}`);
        if (res.status === 404) {
          setStatus("error");
          setErrorMsg("Job expired or backend restarted.");
          clearInterval(interval);
          return;
        }
        const data = await res.json();
        setStage(data.stage || "Working");
        setProgress(data.progress || 0);
        setLogs(data.logs || []);

        if (data.status === "done") {
          setResult(data.result);
          setStatus("done");
          clearInterval(interval);
        } else if (data.status === "error") {
          setErrorMsg(data.error || "Agent execution failed.");
          setStatus("error");
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [jobId, status]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!topic.trim() || topic.length < 3) return;

    setStatus("running");
    setStage("Queued");
    setProgress(0.05);
    setLogs(["[System] Submitting task to Oxalis AI backend..."]);
    setResult("");
    setErrorMsg("");

    try {
      const res = await fetch(`${BACKEND_URL}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_topic: topic.trim(),
          timeframe,
          additional_context: context.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setJobId(data.job_id);
    } catch (err) {
      setStatus("error");
      setErrorMsg(`Could not connect to backend at ${BACKEND_URL}. Ensure FastAPI is running. (${err.message})`);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.toLowerCase().replace(/[^a-z0-9]/g, "_")}_blueprint.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="blueprint-grid flex min-h-screen flex-col font-sans text-[#111] antialiased selection:bg-[#DF4118] selection:text-white">
      <style>{GLOBAL_CSS}</style>

      <TopBar status={status} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-16 sm:px-8">
        <Hero />

        {errorMsg && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 border border-[#DF4118] border-l-[6px] bg-white px-4 py-3"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#DF4118]" />
            <div className="font-mono text-xs leading-relaxed text-[#111]">
              <span className="mr-2 font-bold uppercase tracking-[0.2em] text-[#DF4118]">Err //</span>
              {errorMsg}
            </div>
          </div>
        )}

        <section className="mb-10 border border-[#111] bg-white shadow-[8px_8px_0_0_#111]">
          <div className="grid lg:grid-cols-12">
            <div className="lg:col-span-5">
              <ParametersCell
                topic={topic}
                setTopic={setTopic}
                timeframe={timeframe}
                setTimeframe={setTimeframe}
                context={context}
                setContext={setContext}
                status={status}
                stage={stage}
                onSubmit={handleSubmit}
              />
            </div>
            <div className="lg:col-span-7">
              <PipelineCell status={status} stage={stage} />
            </div>
          </div>
          <TelemetryCell
            status={status}
            stage={stage}
            progress={progress}
            logs={logs}
            jobId={jobId}
            logsEndRef={logsEndRef}
          />
        </section>

        <OutputViewport
          status={status}
          stage={stage}
          result={result}
          logs={logs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onDownload={handleDownload}
        />
      </main>

      <Footer />
    </div>
  );
}
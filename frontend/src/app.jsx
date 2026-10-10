import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Terminal, FileText, Download, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
const POLL_INTERVAL = 1500;

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
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Polling effect when a job is running
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
        // Transient network hiccup, keep trying
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
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">☘️</span>
            <div>
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                Oxalis AI
              </h1>
              <p className="text-xs text-slate-400">Multi-Agent Strategy Swarm & RAG Engine</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Vector RAG Active</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto px-6 py-10 flex-grow">
        {/* Intro */}
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white mb-3">
            Oxalis AI
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
            Collaborative agents (<span className="text-emerald-400 font-medium">Planner</span>, <span className="text-emerald-400 font-medium">Retriever + RAG</span>, and <span className="text-emerald-400 font-medium">Executor</span>) research, synthesize, and compile production-ready roadmaps.
          </p>
        </div>

        {/* Input Form Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm mb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Project Goal / Topic
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Design a real-time collaborative code editor with WebSockets"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Execution Timeframe
                </label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                >
                  <option>Short Analysis</option>
                  <option>1 Week Phase</option>
                  <option>1 Month Phase</option>
                  <option>1 Year Phase</option>
                  <option>Longer than a year</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Constraints or Tech Stack Preferences
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g. Serverless only, zero cost budget"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={status === "running"}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-900/50 disabled:text-slate-500 text-slate-950 font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {status === "running" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Agents Collapsing & Reasoning ({stage})...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Launch Oxalis Intelligence Swarm</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Error Display */}
        {errorMsg && (
          <div className="mb-8 bg-red-950/40 border border-red-900/50 rounded-xl p-4 flex items-start space-x-3 text-red-300">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">{errorMsg}</div>
          </div>
        )}

        {/* Progress & Live Logs (While Running) */}
        {status === "running" && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl mb-8 space-y-4">
            <div className="flex justify-between items-center text-xs font-medium text-slate-400 uppercase tracking-wider">
              <span>Current Stage: <strong className="text-emerald-400">{stage} Agent</strong></span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(progress * 100, 5)}%` }}
              ></div>
            </div>

            {/* Live Terminal logs */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 font-mono text-xs text-slate-300 h-48 overflow-y-auto space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="flex space-x-2">
                  <span className="text-slate-600">›</span>
                  <span className="text-slate-300">{log}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
            {/* Tab navigation */}
            <div className="border-b border-slate-800/80 bg-slate-900/80 px-6 py-3 flex items-center justify-between">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab("blueprint")}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all ${
                    activeTab === "blueprint"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Project Blueprint</span>
                </button>
                <button
                  onClick={() => setActiveTab("logs")}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all ${
                    activeTab === "logs"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  <span>Agent Logs</span>
                </button>
              </div>

            </div>

            {/* Tab Body */}
            <div className="p-8">
              {activeTab === "blueprint" ? (
                <article className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                </article>
              ) : (
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 font-mono text-xs text-slate-300 h-96 overflow-y-auto space-y-1">
                  {logs.map((log, index) => (
                    <div key={index} className="flex space-x-2">
                      <span className="text-slate-600">›</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {result && (
          <button
            type="button"
            onClick={handleDownload}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-emerald-950/40 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            <Download className="h-4 w-4" />
            <span>Download .md</span>
          </button>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/20 py-6 text-center text-xs text-slate-500">
        <p>Oxalis AI | Built for High-Performance Agentic Intelligence</p>
      </footer>
    </div>
  );
}
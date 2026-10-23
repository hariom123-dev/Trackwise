import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  RotateCcw, 
  Bot, 
  User, 
  TrendingUp, 
  Percent, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight,
  ShieldAlert,
  Loader2,
  ChevronDown,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../utils/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metricsSnapshot?: {
    revenue: number;
    expenses: number;
    margin: number;
    churn: number;
    customers: number;
    momGrowth?: number;
    arpu?: number;
    ltv?: number;
    ruleOf40?: number;
  } | null;
  createdAt: string;
}

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  {
    label: "Diagnose Unit Economics & Rule of 40",
    query: "Diagnose my unit economics & Rule of 40",
    icon: TrendingUp,
  },
  {
    label: "Analyze Margin & Churn Risks",
    query: "Where are my biggest margin & churn risks?",
    icon: AlertCircle,
  },
  {
    label: "Simulate Bridge to $250k MRR",
    query: "How much do I need to cut churn to hit $250k MRR?",
    icon: ArrowUpRight,
  },
  {
    label: "Executive 12-Month Investor Brief",
    query: "Summarize my 12-month trajectory for investors",
    icon: CheckCircle2,
  },
];

export default function AICopilotDrawer({ isOpen, onClose }: AICopilotDrawerProps) {
  const { activeWorkspace } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Latest telemetry snapshot for top KPI badges
  const latestSnapshot = messages.slice().reverse().find((m) => m.metricsSnapshot)?.metricsSnapshot || {
    revenue: 99200,
    expenses: 56200,
    margin: 43.3,
    churn: 1.5,
    customers: 2450,
    ruleOf40: 55.3,
  };

  useEffect(() => {
    if (isOpen) {
      loadMessages();
      setTimeout(() => textareaRef.current?.focus(), 250);
    }
  }, [isOpen, activeWorkspace?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadMessages = async () => {
    try {
      setFetchingHistory(true);
      const res = await apiFetch<{ messages: ChatMessage[] }>('/api/copilot/messages');
      if (res && res.messages) {
        setMessages(res.messages);
      }
    } catch (err: any) {
      console.error('Failed to load chat messages:', err);
    } finally {
      setFetchingHistory(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    setInputMessage('');
    setLoading(true);

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: 'usr_temp_' + Date.now(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await apiFetch<{
        userMessage: ChatMessage;
        assistantMessage: ChatMessage;
      }>('/api/copilot/ask', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });

      if (res && res.assistantMessage) {
        setMessages((prev) => {
          // Replace temp user message with persisted one and append assistant
          const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
          return [...filtered, res.userMessage, res.assistantMessage];
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send question to AI Analyst.');
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: '⚠️ I encountered an error analyzing your telemetry. Please verify your connection and try again.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetConversation = async () => {
    if (!window.confirm('Reset your AI Analyst conversation history? This will re-seed a fresh analysis.')) {
      return;
    }
    try {
      setLoading(true);
      const res = await apiFetch<{ initialMessage?: ChatMessage }>('/api/copilot/messages', {
        method: 'DELETE',
      });
      if (res && res.initialMessage) {
        setMessages([res.initialMessage]);
      } else {
        setMessages([]);
      }
      toast.success('AI Copilot history reset successfully.');
    } catch (err: any) {
      toast.error('Failed to reset conversation.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to format structured text into headers, bullets, and paragraphs
  const renderFormattedText = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-2 text-xs leading-relaxed text-slate-800">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;

          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} className="text-sm font-bold text-slate-900 mt-2 mb-1 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-600 shrink-0" />
                <span>{trimmed.replace('### ', '')}</span>
              </h4>
            );
          }
          if (trimmed.startsWith('#### ')) {
            return (
              <h5 key={idx} className="text-xs font-bold text-slate-800 mt-2 mb-0.5">
                {trimmed.replace('#### ', '')}
              </h5>
            );
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const bulletText = trimmed.replace(/^[-*]\s+/, '');
            // Bold highlights within bullets
            const parts = bulletText.split(/(\*\*.*?\*\*)/g);
            return (
              <div key={idx} className="flex items-start gap-2 pl-1 my-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <span className="flex-1">
                  {parts.map((p, pIdx) => {
                    if (p.startsWith('**') && p.endsWith('**')) {
                      return (
                        <strong key={pIdx} className="font-semibold text-slate-900">
                          {p.slice(2, -2)}
                        </strong>
                      );
                    }
                    return p;
                  })}
                </span>
              </div>
            );
          }
          if (/^\d+\.\s+/.test(trimmed)) {
            const num = trimmed.match(/^\d+/)?.[0] || '1';
            const numText = trimmed.replace(/^\d+\.\s+/, '');
            const parts = numText.split(/(\*\*.*?\*\*)/g);
            return (
              <div key={idx} className="flex items-start gap-2 pl-1 my-1">
                <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md shrink-0 mt-0.5">
                  {num}
                </span>
                <span className="flex-1">
                  {parts.map((p, pIdx) => {
                    if (p.startsWith('**') && p.endsWith('**')) {
                      return (
                        <strong key={pIdx} className="font-semibold text-slate-900">
                          {p.slice(2, -2)}
                        </strong>
                      );
                    }
                    return p;
                  })}
                </span>
              </div>
            );
          }

          // Regular paragraph with inline **bold**
          const parts = trimmed.split(/(\*\*.*?\*\*)/g);
          return (
            <p key={idx}>
              {parts.map((p, pIdx) => {
                if (p.startsWith('**') && p.endsWith('**')) {
                  return (
                    <strong key={pIdx} className="font-semibold text-slate-900">
                      {p.slice(2, -2)}
                    </strong>
                  );
                }
                return p;
              })}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[80]"
          />

          {/* Slide-Over Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 h-screen w-full sm:w-[500px] bg-white shadow-2xl z-[90] flex flex-col border-l border-slate-200"
          >
            {/* Header */}
            <div className="p-4 sm:px-6 border-b border-slate-200/80 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/80 border border-indigo-400/30 flex items-center justify-center text-white shadow-md">
                  <Sparkles size={18} className="text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold tracking-tight">AI Financial Analyst</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Live Telemetry
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">
                    {activeWorkspace?.name || 'Kinetic Global Analytics'} ({activeWorkspace?.industry || 'SaaS'}) • SQLite Telemetry
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleResetConversation}
                  disabled={loading}
                  title="Reset conversation thread"
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                  aria-label="Close copilot"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Live KPI Telemetry Ribbon */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto text-[11px] shrink-0">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                <span className="text-slate-400 uppercase tracking-wider text-[9px]">MRR:</span>
                <span className="text-emerald-600 font-bold">${latestSnapshot.revenue.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                <span className="text-slate-400 uppercase tracking-wider text-[9px]">Margin:</span>
                <span className="text-indigo-600 font-bold">{latestSnapshot.margin}%</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                <span className="text-slate-400 uppercase tracking-wider text-[9px]">Churn:</span>
                <span className="text-blue-600 font-bold">{latestSnapshot.churn}%</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                <span className="text-slate-400 uppercase tracking-wider text-[9px]">Rule of 40:</span>
                <span className="text-purple-600 font-bold">{latestSnapshot.ruleOf40 || 55}%</span>
              </div>
            </div>

            {/* Quick Prompt Chips */}
            <div className="p-3 bg-white border-b border-slate-100 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
              {QUICK_PROMPTS.map((qp, i) => (
                <button
                  key={i}
                  disabled={loading}
                  onClick={() => handleSendMessage(qp.query)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-transparent text-slate-600 text-[11px] font-semibold whitespace-nowrap transition-all shadow-2xs shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <qp.icon size={12} className="text-indigo-600" />
                  <span>{qp.label}</span>
                </button>
              ))}
            </div>

            {/* Chat Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
              {fetchingHistory ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                  <Loader2 size={24} className="animate-spin text-indigo-600" />
                  <p className="text-xs font-medium">Retrieving telemetry and conversation...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
                    <Bot size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Your AI CFO Analyst is Ready</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Ask questions about your telemetry, sensitivity models, burn rate, or Rule of 40 score.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isAssistant = msg.role === 'assistant';
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${isAssistant ? 'items-start' : 'items-start justify-end'}`}
                    >
                      {isAssistant && (
                        <div className="w-7 h-7 rounded-xl bg-indigo-900 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                          <Bot size={15} className="text-emerald-400" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-2xl p-3.5 shadow-xs ${
                          isAssistant
                            ? 'bg-white border border-slate-200/80 text-slate-900'
                            : 'bg-indigo-600 text-white font-medium text-xs leading-relaxed'
                        }`}
                      >
                        {isAssistant ? (
                          <>
                            {renderFormattedText(msg.content)}
                            {msg.metricsSnapshot && (
                              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                                <span className="flex items-center gap-1">
                                  <Info size={11} className="text-indigo-500" />
                                  Telemetry Grounded ($
                                  {msg.metricsSnapshot.revenue.toLocaleString()} MRR | {msg.metricsSnapshot.margin}%
                                  Margin)
                                </span>
                                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <p>{msg.content}</p>
                            <span className="block text-[9px] text-indigo-200 text-right mt-1">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        )}
                      </div>

                      {!isAssistant && (
                        <div className="w-7 h-7 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                          <User size={14} />
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}

              {loading && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-indigo-900 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <Bot size={15} className="text-emerald-400" />
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <Loader2 size={14} className="animate-spin text-indigo-600" />
                    <span>Analyzing SQLite financial telemetry & formulating CFO breakdown...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="relative flex items-center"
              >
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask your AI CFO about capital allocation, runway, or churn..."
                  rows={2}
                  disabled={loading}
                  className="w-full resize-none bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl pl-3.5 pr-12 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden transition-all leading-normal"
                />

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || loading}
                  className="absolute right-2.5 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="Send query"
                >
                  <Send size={14} />
                </button>
              </form>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mt-2 px-1">
                <span>Press Enter to send, Shift+Enter for newline</span>
                <span className="flex items-center gap-1 text-slate-500">
                  <ShieldAlert size={10} className="text-emerald-600" />
                  SQLite Grounded Analysis
                </span>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

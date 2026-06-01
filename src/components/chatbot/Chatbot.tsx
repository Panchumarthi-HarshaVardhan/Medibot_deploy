import { authFetch } from '@/utils/api';
import { useState, useRef, useEffect, useMemo } from 'react';
import { MessageCircle, X, Send, Bot, User, Plus, PanelLeft, Maximize2, Minimize2, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { ChatMessage } from '@/types';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/context/AuthContext';
import { useVoice } from '@/hooks/useVoice';
import { useAppointments } from '@/hooks/useAppointments';
import { usePrescriptions } from '@/hooks/usePrescriptions';
import { useMedications } from '@/hooks/useMedications';

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

function formatBotReply(data: {
  content?: string;
  message?: string;
  error?: string;
  type?: string;
  data?: Record<string, unknown>;
}): string {
  if (data.content) return data.content;
  if (data.message) return data.message;
  if (data.error) return data.error;
  if (data.type === 'symptom_analysis' && data.data) {
    const d = data.data as { condition?: string; severity?: string; advice?: string; recommendation?: string };
    return [
      d.condition && `Condition: ${d.condition}`,
      d.severity && `Severity: ${d.severity}`,
      d.advice && `Advice: ${d.advice}`,
      d.recommendation && `Recommendation: ${d.recommendation}`,
    ]
      .filter(Boolean)
      .join('\n');
  }
  return 'Sorry, I could not generate a response.';
}

const welcomeMessage = (role?: string | null) => {
  if (role === 'doctor') {
    return "Hello! I'm MediBot. I can help you manage appointments, accept or reject requests, and write prescriptions. What do you need?";
  }
  return "Hello! I'm MediBot. I can help with symptoms, appointments, medication reminders, and medical history. What can I do for you?";
};

const createDefaultSession = (role?: string | null): ChatSession => ({
  id: Date.now().toString(),
  title: 'New Chat',
  messages: [
    {
      id: `${Date.now()}-bot`,
      text: welcomeMessage(role),
      sender: 'bot',
      timestamp: new Date()
    }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

export const Chatbot = () => {
  const { user } = useAuthContext();
  const { fetchAppointments } = useAppointments();
  const { fetchPrescriptions } = usePrescriptions();
  const { fetchMedications } = useMedications();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [lastMessageWasVoiceInput, setLastMessageWasVoiceInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isListening: isVoiceListening,
    isSpeaking,
    transcript,
    startListening: startVoiceListening,
    stopListening: stopVoiceListening,
    speak,
    cancelSpeech,
    isSupported: voiceSupported,
    error: voiceError,
    clearError: clearVoiceError,
  } = useVoice();

  // Mirror live transcript into input while mic is active
  useEffect(() => {
    if (isVoiceListening && transcript) setInputValue(transcript);
  }, [isVoiceListening, transcript]);
  const [context] = useState<{ age?: number; gender?: string; symptoms?: string[] }>({});
  const storageKey = useMemo(() => `health_chat_sessions_${user?.id || 'guest'}`, [user?.id]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0] || null,
    [sessions, activeSessionId]
  );
  const messages = activeSession?.messages || [];

  const updateActiveSessionMessages = (newMessages: ChatMessage[]) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSession?.id
          ? {
              ...session,
              messages: newMessages,
              title:
                session.title === 'New Chat' && newMessages.length > 1
                  ? newMessages[1].text.slice(0, 28)
                  : session.title,
              updatedAt: new Date().toISOString()
            }
          : session
      )
    );
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatSession[];
      const hydrated = parsed.map((session) => ({
        ...session,
        messages: session.messages.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
      }));
      setSessions(hydrated);
      setActiveSessionId(hydrated[0]?.id || null);
      return;
    }

    const initial = createDefaultSession(user?.role);
    setSessions([initial]);
    setActiveSessionId(initial.id);
  }, [storageKey, user?.role]);

  useEffect(() => {
    if (!sessions.length) return;
    localStorage.setItem(storageKey, JSON.stringify(sessions));
  }, [sessions, storageKey]);

  const createNewChat = () => {
    const newSession = createDefaultSession(user?.role);
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setInputValue('');
  };

  // Mic button handler — tap to start, tap again to stop & send
  const handleMicPress = () => {
    if (isVoiceListening) {
      const finalText = stopVoiceListening();
      if (finalText) {
        setInputValue(finalText);
        setLastMessageWasVoiceInput(true);
      }
    } else {
      clearVoiceError();
      setInputValue('');
      startVoiceListening();
    }
  };

  // Per-message read-aloud button
  const handleSpeakMessage = async (text: string) => {
    if (isSpeaking) cancelSpeech();
    else await speak(text);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !activeSession) return;

    if (!user?.token) {
      const botMessage: ChatMessage = {
        id: Date.now().toString(),
        text: 'Your session expired. Please log out and sign in again.',
        sender: 'bot',
        timestamp: new Date(),
      };
      updateActiveSessionMessages([...messages, botMessage]);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    const userMessageList = [...messages, userMessage];
    updateActiveSessionMessages(userMessageList);
    const messageText = inputValue;
    setInputValue('');
    setIsTyping(true);

    try {
      const requestContext = { ...context, userId: user?.id || null, userRole: user?.role || null, userName: user?.name || null };
      const response = await authFetch('/api/chatbot', {
        method: 'POST',
        body: JSON.stringify({ message: messageText, context: requestContext }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (data as { error?: string }).error ||
            (response.status === 401 ? 'Please log in to use the chatbot.' : 'Chatbot request failed')
        );
      }

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: formatBotReply(data),
        sender: 'bot',
        timestamp: new Date()
      };

      updateActiveSessionMessages([...userMessageList, botMessage]);

      // Refresh data based on chatbot response type
      if (data.type === 'appointment_booked' || data.type === 'appointment_updated') {
        fetchAppointments();
      }
      if (data.type === 'prescription_created') {
        fetchAppointments();
        fetchPrescriptions();
      }
      if (data.type === 'medication_reminder_created' || data.type === 'medication_reminder') {
        fetchMedications();
      }
      
      // Auto-speak when voice mode is enabled OR last message was from voice input
      if (voiceMode || lastMessageWasVoiceInput) await speak(botMessage.text);
      
      // Reset the flag
      setLastMessageWasVoiceInput(false);
    } catch (error) {
      console.error('Chatbot error:', error);
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      };
      updateActiveSessionMessages([...userMessageList, botMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground",
          "flex items-center justify-center shadow-elevated hover:shadow-glow transition-all duration-300",
          "animate-bounce-gentle hover:animate-none",
          isOpen && "rotate-0"
        )}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Window */}
      <div className={cn(
        "fixed z-50 bg-card rounded-2xl shadow-elevated border border-border overflow-hidden transition-all duration-300 transform",
        isExpanded
          ? "right-6 top-6 bottom-6 w-[min(1100px,calc(100vw-3rem))]"
          : "bottom-24 right-6 w-96 max-w-[calc(100vw-2rem)]",
        "transition-all duration-300 transform",
        isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"
      )}>
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <Bot size={24} />
            </div>
            <div>
              <h3 className="font-semibold">Health Assistant Chatbot</h3>
              <p className="text-sm text-primary-foreground/80">Ask me anything about health</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory((prev) => !prev)}
              className="p-2 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
              title="Toggle chat history"
            >
              <PanelLeft size={16} />
            </button>
            <button
              onClick={createNewChat}
              className="p-2 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
              title="New chat"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="p-2 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        <div className={cn("flex", isExpanded ? "h-[calc(100%-132px)]" : "h-[420px]")}>
          {showHistory && (
            <div className="w-64 border-r border-border bg-muted/20 p-3 overflow-y-auto">
              <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Chat History</div>
              <div className="space-y-2">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setActiveSessionId(session.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border text-sm transition-colors",
                      activeSession?.id === session.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 bg-card"
                    )}
                  >
                    <div className="font-medium truncate">{session.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(session.updatedAt).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col">
            {/* Voice error banner */}
            {voiceError && (
              <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center justify-between gap-2">
                <p className="text-xs text-destructive flex-1">{voiceError}</p>
                <button onClick={clearVoiceError} className="text-destructive hover:opacity-70"><X size={14} /></button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2 animate-fade-in",
                    message.sender === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    message.sender === 'user' ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                  )}>
                    {message.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className={message.sender === 'user' ? "chat-bubble-user" : "chat-bubble-bot"}>
                      <p className="text-sm whitespace-pre-line">{message.text}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] opacity-70">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {message.sender === 'bot' && (
                        <button
                          onClick={() => handleSpeakMessage(message.text)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Listen"
                        >
                          <Volume2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2 animate-fade-in">
                  <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                    <Bot size={16} />
                  </div>
                  <div className="chat-bubble-bot">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card">
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  onClick={() => setInputValue('Check my symptoms: fever, headache, sore throat')}
                  className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  Check Symptoms
                </button>
                <button
                  onClick={() => setInputValue('Book an appointment with Dr. P Harshavardhan on 2026-06-02 at 10:30 for fever and headache')}
                  className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  Book Appointment
                </button>
                <button
                  onClick={() => setInputValue('Set medication reminder for Paracetamol 500mg 3 times a day for 5 days at 08:00 14:00 20:00')}
                  className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  Medication Reminder
                </button>
                <button
                  onClick={() => setInputValue('Analyze my medical history')}
                  className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  Analyze History
                </button>
                <button
                  onClick={() => setInputValue('Update my medical history: I have asthma and allergy to penicillin')}
                  className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  Update History
                </button>
                {user?.role === 'doctor' && (
                  <>
                    <button
                      onClick={() => setInputValue('Accept appointment for patient Rahul on 2026-06-02 at 10:30')}
                      className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                    >
                      Accept Appointment
                    </button>
                    <button
                      onClick={() => setInputValue('Reject appointment for patient Rahul on 2026-06-02 at 10:30')}
                      className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                    >
                      Reject Appointment
                    </button>
                    <button
                      onClick={() => setInputValue('Prescribe Amoxicillin dosage 500mg twice daily instructions after food for patient Rahul on 2026-06-02 at 10:30')}
                      className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                    >
                      Prescribe
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {voiceSupported.stt && (
                  <button
                    onClick={handleMicPress}
                    disabled={isVoiceListening}
                    className={cn(
                      "p-3 rounded-lg border border-border transition-colors",
                      isVoiceListening ? "bg-red-100 text-red-600 animate-pulse" : "bg-muted hover:bg-muted/80"
                    )}
                    title="Voice Input"
                  >
                    {isVoiceListening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                )}
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your message..."
                  className="input-medical flex-1 text-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || !activeSession}
                  className="btn-medical p-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

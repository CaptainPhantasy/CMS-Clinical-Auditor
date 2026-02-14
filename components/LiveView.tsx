import React, { useRef, useState, useEffect } from 'react';
import { connectLiveSession, createPcmBlob } from '../services/geminiService';
import { Mic, MicOff, Volume2, XCircle, FileText, Check, ChevronDown, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface TranscriptItem {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const INTERVIEW_TOPICS = [
  "Power Wheelchair (Group 2)",
  "Hospital Bed (Semi-Electric)",
  "Home Oxygen Therapy",
  "CPAP/BiPAP",
  "Nebulizer",
  "Patient Lift"
];

const LiveView: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [mode, setMode] = useState<'consultant' | 'interview'>('consultant');
  const [topic, setTopic] = useState<string>(INTERVIEW_TOPICS[0]);
  
  // Transcript State
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [currentModelText, setCurrentModelText] = useState('');
  const [currentUserText, setCurrentUserText] = useState('');
  
  // Audio Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, currentModelText, currentUserText]);

  const startSession = async () => {
    try {
      setStatus('connecting');
      setTranscript([]); // Clear previous transcript
      setCurrentModelText('');
      setCurrentUserText('');
      
      // 1. Setup Audio Inputs
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioContextRef.current = inputContext;

      // 2. Setup Audio Outputs
      const outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputAudioContextRef.current = outputContext;

      // 3. Connect to Gemini Live
      const selectedTopic = mode === 'interview' ? topic : undefined;
      
      const sessionPromise = connectLiveSession(
        () => {
            console.log("Live Session Open");
            setStatus('connected');
            setIsConnected(true);

            // Start processing input audio *after* session is open
            const source = inputContext.createMediaStreamSource(stream);
            sourceNodeRef.current = source;
            const processor = inputContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                sessionPromise.then(session => {
                    session.sendRealtimeInput({ media: pcmBlob });
                });
            };
            
            source.connect(processor);
            processor.connect(inputContext.destination);
        },
        async (audioData, transcriptUpdate) => {
            // Handle Transcription Updates
            if (transcriptUpdate) {
               if (transcriptUpdate.role === 'turn_complete' as any) {
                  // Commit current streams to history
                  if (currentUserText.trim()) {
                    setTranscript(prev => [...prev, { id: Date.now().toString() + 'u', role: 'user', text: currentUserText }]);
                    setCurrentUserText('');
                  }
                  if (currentModelText.trim()) {
                    setTranscript(prev => [...prev, { id: Date.now().toString() + 'm', role: 'model', text: currentModelText }]);
                    setCurrentModelText('');
                  }
               } else if (transcriptUpdate.role === 'user') {
                  setCurrentUserText(prev => prev + transcriptUpdate.text);
               } else if (transcriptUpdate.role === 'model') {
                  setCurrentModelText(prev => prev + transcriptUpdate.text);
               }
            }

            // Handle incoming audio
            if (audioData && outputAudioContextRef.current) {
               const ctx = outputAudioContextRef.current;
               
               // Decode custom base64
               const binaryString = atob(audioData);
               const len = binaryString.length;
               const bytes = new Uint8Array(len);
               for (let i = 0; i < len; i++) {
                   bytes[i] = binaryString.charCodeAt(i);
               }
               
               // Convert to Int16 PCM to AudioBuffer
               const dataInt16 = new Int16Array(bytes.buffer);
               const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
               const channelData = buffer.getChannelData(0);
               for (let i = 0; i < dataInt16.length; i++) {
                   channelData[i] = dataInt16[i] / 32768.0;
               }

               const source = ctx.createBufferSource();
               source.buffer = buffer;
               source.connect(ctx.destination);
               
               const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
               source.start(startTime);
               nextStartTimeRef.current = startTime + buffer.duration;
            }
        },
        () => {
            console.log("Session Closed");
            handleDisconnect();
        },
        (err) => {
            console.error(err);
            setStatus('error');
            handleDisconnect();
        },
        selectedTopic
      );

      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error("Failed to start live session", e);
      setStatus('error');
      handleDisconnect();
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setStatus('idle');
    
    // Commit any lingering text
    if (currentUserText.trim()) {
      setTranscript(prev => [...prev, { id: Date.now().toString() + 'u', role: 'user', text: currentUserText }]);
      setCurrentUserText('');
    }
    if (currentModelText.trim()) {
      setTranscript(prev => [...prev, { id: Date.now().toString() + 'm', role: 'model', text: currentModelText }]);
      setCurrentModelText('');
    }

    // Stop tracks
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    
    // Disconnect nodes
    if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
    if (processorRef.current) processorRef.current.disconnect();
    
    // Close Audio Contexts
    if (inputAudioContextRef.current) inputAudioContextRef.current.close();
    if (outputAudioContextRef.current) outputAudioContextRef.current.close();
  };

  useEffect(() => {
    return () => {
      handleDisconnect();
    };
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-in fade-in duration-700">
      
      {/* Top Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 shrink-0">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div>
               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <Mic className="w-5 h-5 text-blue-600" />
                 Live Consultant
               </h2>
               <p className="text-sm text-slate-500">Real-time voice guidance & structured interviews.</p>
             </div>

             <div className="flex flex-col md:flex-row gap-3">
               <div className="flex bg-slate-100 rounded-lg p-1">
                  <button 
                    onClick={() => setMode('consultant')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'consultant' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                    disabled={status !== 'idle'}
                  >
                    General
                  </button>
                  <button 
                    onClick={() => setMode('interview')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'interview' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
                    disabled={status !== 'idle'}
                  >
                    Socratic Interview
                  </button>
               </div>
               
               {mode === 'interview' && (
                 <div className="relative">
                   <select 
                    className="appearance-none bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={status !== 'idle'}
                   >
                     {INTERVIEW_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                   <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 pointer-events-none" />
                 </div>
               )}
             </div>
         </div>
      </div>

      {/* Main Area: Split between Visualizer and Transcript */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
         
         {/* Left: Active Call Visualizer */}
         <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
             {status === 'connected' && (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-emerald-50/50" />
             )}
             
             <div className="relative z-10 text-center space-y-4 md:space-y-6">
                <div className={`w-24 h-24 md:w-32 md:h-32 mx-auto rounded-full flex items-center justify-center transition-all duration-500 ${
                  status === 'connected' ? 'bg-blue-100 animate-pulse ring-4 md:ring-8 ring-blue-50' : 'bg-slate-100'
                }`}>
                  {status === 'connected' ? (
                    <Volume2 className="w-10 h-10 md:w-16 md:h-16 text-blue-600" />
                  ) : (
                    <Mic className="w-10 h-10 md:w-16 md:h-16 text-slate-400" />
                  )}
                </div>
                
                <div className="space-y-2">
                   <h3 className="text-lg font-bold text-slate-800">
                     {status === 'idle' ? 'Ready to Start' : status === 'connecting' ? 'Connecting...' : status === 'connected' ? 'Listening...' : 'Connection Error'}
                   </h3>
                   <p className="text-sm text-slate-500 max-w-xs mx-auto">
                     {mode === 'interview' 
                       ? `I will interview you about the ${topic}. I'll ask one question at a time.` 
                       : "Ask me anything about CMS guidelines or patient scenarios."}
                   </p>
                </div>

                {status === 'idle' || status === 'error' ? (
                  <button
                    onClick={startSession}
                    className="bg-blue-600 text-white px-8 py-3 rounded-full font-semibold shadow-lg hover:bg-blue-700 hover:-translate-y-0.5 transition-all"
                  >
                    Start Session
                  </button>
                ) : (
                   <button
                    onClick={handleDisconnect}
                    className="bg-white text-red-500 border border-red-200 px-8 py-3 rounded-full font-semibold shadow-sm hover:bg-red-50 transition-all"
                  >
                    End Session
                  </button>
                )}
             </div>
         </div>

         {/* Right: Real-time Transcript */}
         <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
               <div className="flex items-center gap-2 text-slate-700">
                 <FileText className="w-4 h-4" />
                 <span className="font-semibold text-sm">Live Transcript</span>
               </div>
               {transcript.length > 0 && (
                 <span className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-600 font-mono">
                    {transcript.length} turns
                 </span>
               )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
               {transcript.length === 0 && !currentUserText && !currentModelText && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                    <p>Conversation text will appear here.</p>
                  </div>
               )}
               
               {transcript.map((t) => (
                 <div key={t.id} className={`flex gap-3 ${t.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                      t.role === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {t.role === 'user' ? 'YOU' : 'AI'}
                    </div>
                    <div className={`text-sm py-2 px-3 rounded-xl max-w-[85%] ${
                      t.role === 'user' ? 'bg-white border border-slate-200 text-slate-700' : 'bg-white border border-emerald-100 shadow-sm text-slate-800'
                    }`}>
                      <ReactMarkdown>{t.text}</ReactMarkdown>
                    </div>
                 </div>
               ))}

               {/* Streaming Bubbles */}
               {currentUserText && (
                 <div className="flex gap-3 flex-row-reverse">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold bg-blue-100 text-blue-700">YOU</div>
                    <div className="text-sm py-2 px-3 rounded-xl max-w-[85%] bg-white border border-slate-200 text-slate-400 italic">
                      {currentUserText}...
                    </div>
                 </div>
               )}
               {currentModelText && (
                 <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold bg-emerald-100 text-emerald-700">AI</div>
                    <div className="text-sm py-2 px-3 rounded-xl max-w-[85%] bg-white border border-emerald-100 shadow-sm text-slate-800">
                      {currentModelText}
                    </div>
                 </div>
               )}
               <div ref={transcriptEndRef} />
            </div>
         </div>
      </div>
    </div>
  );
};

export default LiveView;
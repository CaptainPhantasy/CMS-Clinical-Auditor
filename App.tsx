import React, { useState, useEffect } from 'react';
import TranslatorView from './components/TranslatorView';
import ChatView from './components/ChatView';
import LiveView from './components/LiveView';
import HistoryView from './components/HistoryView';
import OnboardingModal from './components/OnboardingModal';
import { AppMode } from './types';
import { Stethoscope, MessageSquare, Mic, ShieldCheck, History, WifiOff } from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.TRANSLATOR);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [demoInput, setDemoInput] = useState('');

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('cms_auditor_onboarding_seen');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('cms_auditor_onboarding_seen', 'true');
  };

  const handleRunDemo = () => {
    // Pre-fill translator with a complex case for the demo
    setDemoInput("Patient is 78yo female, severe OA in knees. Can't walk to bathroom safely anymore. Hands are too weak for a standard walker. Needs something with wheels and a seat.");
    setMode(AppMode.TRANSLATOR);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Onboarding Wizard */}
      {showOnboarding && (
        <OnboardingModal 
          onClose={handleCloseOnboarding} 
          onRunDemo={handleRunDemo}
        />
      )}

      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-amber-500 text-white text-center py-1 text-xs font-bold flex items-center justify-center space-x-2 sticky top-0 z-[60]">
          <WifiOff className="w-3 h-3" />
          <span>Offline Mode: AI features disabled. History is accessible.</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">CMS Clinical Auditor</h1>
              <p className="text-xs text-slate-500 font-medium">Compliance & Translation Engine</p>
            </div>
          </div>
          
          {/* Desktop Nav */}
          <nav className="hidden md:flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setMode(AppMode.TRANSLATOR)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === AppMode.TRANSLATOR ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Translator
            </button>
            <button
              onClick={() => setMode(AppMode.HISTORY)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === AppMode.HISTORY ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setMode(AppMode.CHAT)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === AppMode.CHAT ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setMode(AppMode.LIVE)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === AppMode.LIVE ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Live
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Nav (Floating Bottom) */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-slate-200 shadow-xl rounded-full px-6 py-3 flex gap-6 z-50">
         <button 
           onClick={() => setMode(AppMode.TRANSLATOR)}
           className={`flex flex-col items-center gap-1 ${mode === AppMode.TRANSLATOR ? 'text-blue-600' : 'text-slate-400'}`}
         >
           <Stethoscope className="w-5 h-5" />
         </button>
         <button 
           onClick={() => setMode(AppMode.HISTORY)}
           className={`flex flex-col items-center gap-1 ${mode === AppMode.HISTORY ? 'text-blue-600' : 'text-slate-400'}`}
         >
           <History className="w-5 h-5" />
         </button>
         <button 
           onClick={() => setMode(AppMode.CHAT)}
           className={`flex flex-col items-center gap-1 ${mode === AppMode.CHAT ? 'text-blue-600' : 'text-slate-400'}`}
         >
           <MessageSquare className="w-5 h-5" />
         </button>
         <button 
           onClick={() => setMode(AppMode.LIVE)}
           className={`flex flex-col items-center gap-1 ${mode === AppMode.LIVE ? 'text-blue-600' : 'text-slate-400'}`}
         >
           <Mic className="w-5 h-5" />
         </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8 pb-24 md:pb-8">
        {mode === AppMode.TRANSLATOR && <TranslatorView initialInput={demoInput} />}
        {mode === AppMode.HISTORY && <HistoryView />}
        {mode === AppMode.CHAT && <ChatView />}
        {mode === AppMode.LIVE && <LiveView />}
      </main>
      
      {/* Disclaimer */}
      <footer className="text-center py-6 text-slate-400 text-xs hidden md:block">
        <p>© 2026 CMS Clinical Auditor. For professional use only. Verify all outputs with current LCDs.</p>
      </footer>
    </div>
  );
};

export default App;
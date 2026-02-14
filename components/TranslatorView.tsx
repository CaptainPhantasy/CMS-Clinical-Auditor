import React, { useState, useEffect, useRef } from 'react';
import { translateClinicalNotes, runMockAudit, fetchDMEGuidelines } from '../services/geminiService';
import { saveToHistory } from '../services/storageService';
import { TranslationResult, MockAuditResult, ImageAttachment } from '../types';
import ReactMarkdown from 'react-markdown';
import { ArrowRight, FileText, CheckCircle, AlertCircle, Loader2, Link as LinkIcon, Lightbulb, Zap, X, Mic, MicOff, Camera, Upload, ShieldAlert, BadgeCheck, MapPin, Clock, BookOpen, ListChecks } from 'lucide-react';

const DME_HINTS = [
  { keywords: ['wheelchair', 'scooter', 'power chair'], label: 'Mobility Device', hint: 'Ensure you document the patient\'s inability to perform MRADLs (Mobility-Related Activities of Daily Living) using a cane or walker. State why lesser equipment is ruled out.' },
  { keywords: ['oxygen', 'o2', 'hypoxemia'], label: 'Respiratory', hint: 'Document O2 saturation levels on room air at rest. For Group I coverage, sats must be ≤88%. If purely nocturnal, document desaturation duration.' },
  { keywords: ['bed', 'hospital bed'], label: 'Hospital Bed', hint: 'Verify need for head elevation >30 degrees (e.g., for aspiration risk or CHF) or body positioning that cannot be achieved in a standard bed.' },
  { keywords: ['commode'], label: 'Commode', hint: 'Document that the patient is physically incapable of accessing the regular bathroom.' },
  { keywords: ['walker', 'cane'], label: 'Ambulation Aid', hint: 'Document the specific mobility deficit and that the patient has the potential to ambulate safely with the device.' }
];

const DME_TRIGGERS: Record<string, string> = {
  'oxygen': 'Home Oxygen Therapy',
  'nebulizer': 'Nebulizer',
  'wheelchair': 'Manual Wheelchair',
  'power chair': 'Power Mobility Device (Group 2)',
  'scooter': 'Power Mobility Device',
  'hospital bed': 'Hospital Bed',
  'cpap': 'PAP Device for OSA',
  'bipap': 'RAD (Respiratory Assist Device)',
  'commode': 'Bedside Commode',
  'walker': 'Walker',
  'lift': 'Patient Lift'
};

const QUICK_TEMPLATES = [
  { label: 'Mobility', text: "Patient is 78yo female, severe OA in knees. Can't walk to bathroom safely anymore. Hands are too weak for a standard walker. Needs something with wheels and a seat." },
  { label: 'Oxygen', text: "Mr. Jones has COPD. O2 sats are dropping to 85% when he walks around the house. On room air at rest he is 88%. He needs home oxygen." },
  { label: 'Hospital Bed', text: "Patient is bedbound due to severe stroke. Needs a hospital bed because they can't sleep flat due to aspiration risk and needs head elevated 45 degrees." }
];

const TranslatorView: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeHint, setActiveHint] = useState<{label: string, hint: string} | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  // Guide / Cheat Sheet State
  const [guideKeyword, setGuideKeyword] = useState<string | null>(null);
  const [guidelines, setGuidelines] = useState<string[]>([]);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const guidelineCache = useRef<Record<string, string[]>>({});

  // Image Attachment State
  const [image, setImage] = useState<ImageAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audit State
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<MockAuditResult | null>(null);

  // Voice Dictation State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // EVV State
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Initialize Speech Recognition & Geolocation
  useEffect(() => {
    // Geolocation
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log("Geo not available", err),
        { enableHighAccuracy: true }
      );
    }

    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
             setInput(prev => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + finalTranscript);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };
        
        recognitionRef.current.onend = () => {
             if (isListening) setIsListening(false);
        };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError("Voice dictation is not supported in this browser.");
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setError(null);
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Image Handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result as string;
        // Extract base64 data and mime type
        const matches = result.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
           setImage({
             mimeType: matches[1],
             data: matches[2],
             previewUrl: result
           });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Loading text rotation
  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % 3);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  // Real-time DME Detection & Cheat Sheet Trigger
  useEffect(() => {
    const lowerInput = input.toLowerCase();
    
    // 1. Static Hints
    const foundHint = DME_HINTS.find(d => d.keywords.some(k => lowerInput.includes(k)));
    if (foundHint) {
      setActiveHint({ label: foundHint.label, hint: foundHint.hint });
    } else {
      setActiveHint(null);
    }

    // 2. Debounced Live Guide Fetching
    const checkKeywords = async () => {
      const match = Object.keys(DME_TRIGGERS).find(key => lowerInput.includes(key));
      
      if (match) {
        const formalName = DME_TRIGGERS[match];
        
        // Only fetch if context changed
        if (guideKeyword !== formalName) {
           setGuideKeyword(formalName);
           
           if (guidelineCache.current[formalName]) {
             setGuidelines(guidelineCache.current[formalName]);
           } else {
             setLoadingGuide(true);
             try {
               const points = await fetchDMEGuidelines(formalName);
               guidelineCache.current[formalName] = points;
               setGuidelines(points);
             } catch (e) {
               console.error(e);
             } finally {
               setLoadingGuide(false);
             }
           }
        }
      }
    };

    const timer = setTimeout(checkKeywords, 1500); // 1.5s debounce for cheat sheet
    return () => clearTimeout(timer);

  }, [input, guideKeyword]);

  const handleTranslate = async () => {
    if (!input.trim() && !image) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setAuditResult(null);

    const duration = (Date.now() - startTimeRef.current) / 60000; // in minutes

    const evv = location ? {
      latitude: location.lat,
      longitude: location.lng,
      timestamp: new Date().toLocaleString(),
      duration: duration
    } : undefined;

    try {
      const data = await translateClinicalNotes(input, image || undefined, evv);
      setResult(data);
      
      // Auto-save to history
      const tags = activeHint ? [activeHint.label] : ['General'];
      saveToHistory(input, data, tags);
      
    } catch (err) {
      setError("Failed to translate. Please check your connection or API key.");
    } finally {
      setLoading(false);
    }
  };

  const handleMockAudit = async () => {
    if (!result?.text) return;
    setIsAuditing(true);
    try {
      const audit = await runMockAudit(result.text);
      setAuditResult(audit);
    } catch (err) {
      setError("Failed to complete audit.");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleClear = () => {
    setInput('');
    setImage(null);
    setResult(null);
    setAuditResult(null);
    setError(null);
    setGuideKeyword(null);
    setGuidelines([]);
    startTimeRef.current = Date.now(); // Reset timer
  };

  const loadTemplate = (text: string) => {
    setInput(text);
    setImage(null);
    setResult(null);
    setAuditResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    startTimeRef.current = Date.now(); // Reset timer
  };

  const getLoadingText = () => {
    switch (loadingStep) {
      case 0: return image ? "Analyzing visual evidence & notes..." : "Analyzing clinical observations...";
      case 1: return location ? "Verifying EVV Location & LCDs..." : "Cross-referencing 2026 LCDs...";
      case 2: return "Generating compliance checklist...";
      default: return "Auditing Guidelines...";
    }
  };

  return (
    <div className={`mx-auto transition-all duration-700 ease-in-out ${guideKeyword ? 'max-w-7xl' : 'max-w-3xl'} space-y-8`}>
      
      {/* Quick Templates */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide max-w-3xl mx-auto">
        <span className="flex items-center text-xs font-bold text-slate-400 uppercase mr-2 shrink-0">
          <Zap className="w-3 h-3 mr-1" />
          Load Case:
        </span>
        {QUICK_TEMPLATES.map((t, i) => (
          <button
            key={i}
            onClick={() => loadTemplate(t.text)}
            className="whitespace-nowrap px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Main Input Column */}
        <div className="flex-1 space-y-8 min-w-0">
          {/* Input Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative transition-shadow hover:shadow-md">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-700">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-sm uppercase tracking-wide">Patient Clinical Observations</span>
              </div>
              <div className="flex items-center space-x-3">
                 {location && (
                   <div className="flex items-center space-x-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold uppercase tracking-wider">
                     <MapPin className="w-3 h-3" />
                     <span>EVV Active</span>
                   </div>
                 )}
                 {(input || image) && (
                   <button 
                    onClick={handleClear}
                    className="text-xs text-slate-400 hover:text-red-500 flex items-center space-x-1 transition-colors ml-2"
                   >
                     <X className="w-3 h-3" />
                     <span>Clear</span>
                   </button>
                 )}
              </div>
            </div>
            
            <div className="relative">
                <textarea
                  className="w-full h-48 p-6 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-lg leading-relaxed resize-y"
                  placeholder="Type notes or capture voice/photos..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                
                {/* Action Buttons: Dictation & Camera */}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileSelect} 
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-3 rounded-full shadow-lg transition-all transform border ${
                      image
                        ? 'bg-blue-100 text-blue-600 border-blue-300' 
                        : 'bg-white text-slate-400 border-slate-200 hover:text-blue-600 hover:border-blue-300'
                    }`}
                    title="Add Home Environment Photo"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  
                  <button
                    onClick={toggleListening}
                    className={`p-3 rounded-full shadow-lg transition-all transform ${
                      isListening 
                        ? 'bg-red-500 text-white animate-pulse scale-110' 
                        : 'bg-white text-slate-400 border border-slate-200 hover:text-blue-600 hover:border-blue-300'
                    }`}
                    title={isListening ? "Stop Dictation" : "Start Dictation"}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                </div>
            </div>

            {/* Image Preview */}
            {image && (
              <div className="px-6 pb-4 flex items-center">
                 <div className="relative group">
                    <img src={image.previewUrl} alt="Evidence" className="h-16 w-16 object-cover rounded-lg border border-slate-300 shadow-sm" />
                    <button 
                      onClick={() => setImage(null)}
                      className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 border border-slate-200 text-slate-500 hover:text-red-500 shadow-sm"
                    >
                      <X className="w-3 h-3" />
                    </button>
                 </div>
                 <div className="ml-3 text-sm text-slate-500">
                   <span className="font-semibold text-blue-600">Image Attached:</span> The AI will extract clinical evidence from this photo.
                 </div>
              </div>
            )}
            
            {/* Smart Hint Overlay */}
            {activeHint && (
              <div className="bg-amber-50 border-y border-amber-100 px-6 py-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="bg-amber-100 p-1.5 rounded-full shrink-0">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-700 uppercase mb-0.5">{activeHint.label} Detected</p>
                  <p className="text-sm text-amber-900 leading-snug">{activeHint.hint}</p>
                </div>
              </div>
            )}

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
               <button
                onClick={handleTranslate}
                disabled={loading || (!input.trim() && !image)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all shadow-md ${
                  loading || (!input.trim() && !image)
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 hover:shadow-lg'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="w-48 text-left">{getLoadingText()}</span>
                  </>
                ) : (
                  <>
                    <span>Translate to CMS Terminology</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Result Section */}
          {result && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between text-white">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-bold tracking-wide">CMS Compliant Output</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                     {!auditResult && !isAuditing && (
                       <button 
                        onClick={handleMockAudit}
                        className="flex items-center space-x-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border border-white/30"
                       >
                         <ShieldAlert className="w-3 h-3" />
                         <span>Run "Devil's Advocate" Audit</span>
                       </button>
                     )}
                     <span className="text-xs bg-emerald-700 px-2 py-1 rounded text-emerald-100 font-medium">Auto-Saved</span>
                  </div>
                </div>

                {/* Mock Audit Result Box */}
                {(isAuditing || auditResult) && (
                  <div className="border-b-4 border-slate-100 animate-in slide-in-from-top-2">
                     {isAuditing ? (
                       <div className="p-6 bg-slate-50 flex items-center justify-center space-x-3 text-slate-500">
                          <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                          <span className="font-medium">Auditing for logical loopholes and denial risks...</span>
                       </div>
                     ) : auditResult ? (
                       <div className={`p-6 ${
                         auditResult.riskScore === 'HIGH' ? 'bg-red-50 border-l-4 border-l-red-500' :
                         auditResult.riskScore === 'MEDIUM' ? 'bg-amber-50 border-l-4 border-l-amber-500' :
                         'bg-green-50 border-l-4 border-l-green-500'
                       }`}>
                          <div className="flex items-start justify-between mb-2">
                             <div className="flex items-center space-x-2">
                               <ShieldAlert className={`w-5 h-5 ${
                                  auditResult.riskScore === 'HIGH' ? 'text-red-600' :
                                  auditResult.riskScore === 'MEDIUM' ? 'text-amber-600' : 'text-green-600'
                               }`} />
                               <span className="font-bold text-slate-800 uppercase tracking-wide text-sm">Denial Risk Score:</span>
                               <span className={`font-bold px-2 py-0.5 rounded text-sm ${
                                  auditResult.riskScore === 'HIGH' ? 'bg-red-200 text-red-800' :
                                  auditResult.riskScore === 'MEDIUM' ? 'bg-amber-200 text-amber-800' :
                                  'bg-green-200 text-green-800'
                               }`}>{auditResult.riskScore}</span>
                             </div>
                          </div>
                          <p className="text-slate-800 font-medium text-sm mb-3">"{auditResult.auditorFeedback}"</p>
                          {auditResult.missingCriteria.length > 0 && (
                            <div className="bg-white/60 p-3 rounded-lg border border-slate-200/50">
                              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Missing for Approval:</p>
                              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                                {auditResult.missingCriteria.map((c, i) => <li key={i}>{c}</li>)}
                              </ul>
                            </div>
                          )}
                       </div>
                     ) : null}
                  </div>
                )}
                
                <div className="p-8 prose prose-slate max-w-none prose-headings:font-bold prose-h2:text-xl prose-h2:text-blue-900 prose-p:text-slate-700 prose-li:text-slate-700">
                  <ReactMarkdown>{result.text}</ReactMarkdown>
                </div>

                {/* Citations/Grounding */}
                {result.groundingChunks && result.groundingChunks.length > 0 && (
                  <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Verified Sources (2026 Guidelines)</p>
                    <div className="flex flex-wrap gap-2">
                      {result.groundingChunks.map((chunk, idx) => (
                        chunk.web && (
                          <a
                            key={idx}
                            href={chunk.web.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1 bg-white border border-slate-300 rounded-full px-3 py-1 text-xs text-blue-600 hover:text-blue-800 hover:border-blue-400 transition-colors"
                          >
                            <LinkIcon className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{chunk.web.title}</span>
                          </a>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cheat Sheet Sidebar (Desktop & Mobile Responsive) */}
        {guideKeyword && (
          <div className="w-full lg:w-80 shrink-0 animate-in slide-in-from-right-4 fade-in duration-500">
             <div className="bg-white rounded-xl shadow-lg border border-blue-200 overflow-hidden lg:sticky lg:top-24">
               <div className="bg-blue-600 px-4 py-3 flex items-center justify-between text-white">
                 <div className="flex items-center gap-2">
                   <BookOpen className="w-5 h-5" />
                   <span className="font-bold text-sm">2026 Live Guide</span>
                 </div>
                 <button onClick={() => setGuideKeyword(null)} className="text-blue-100 hover:text-white">
                   <X className="w-4 h-4" />
                 </button>
               </div>
               
               <div className="p-4 bg-blue-50/50 min-h-[200px] max-h-[60vh] overflow-y-auto">
                 <div className="mb-3">
                   <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Device Category</span>
                   <h3 className="text-lg font-bold text-blue-900 leading-tight">{guideKeyword}</h3>
                 </div>

                 {loadingGuide ? (
                   <div className="flex flex-col items-center justify-center py-8 text-blue-400 space-y-2">
                     <Loader2 className="w-6 h-6 animate-spin" />
                     <span className="text-xs">Fetching 2026 LCDs...</span>
                   </div>
                 ) : guidelines.length > 0 ? (
                   <div className="space-y-3">
                     <p className="text-xs text-slate-500 italic">Mandatory coverage checklist:</p>
                     {guidelines.map((point, i) => (
                       <div key={i} className="flex gap-2 group">
                          <div className="mt-0.5 min-w-[16px]">
                             <div className="w-4 h-4 rounded border border-blue-300 bg-white flex items-center justify-center group-hover:border-blue-500 cursor-pointer">
                               <CheckCircle className="w-3 h-3 text-white group-active:text-blue-500" />
                             </div>
                          </div>
                          <p className="text-sm text-slate-700 leading-snug">{point}</p>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div className="text-center py-6 text-slate-400 text-sm">
                     <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                     <p>No guidelines found.</p>
                   </div>
                 )}
               </div>
               <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-center">
                 <p className="text-[10px] text-slate-400">Data sourced via Google Search Grounding</p>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranslatorView;
import React, { useState } from 'react';
import { ShieldCheck, Mic, FileText, ArrowRight, X, Sparkles, CheckCircle } from 'lucide-react';

interface OnboardingModalProps {
  onClose: () => void;
  onRunDemo: () => void;
}

const STEPS = [
  {
    icon: Sparkles,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    title: "Welcome to CMS Clinical Auditor",
    desc: "Your AI-powered partner for Medicare compliance. We turn natural clinical language into audit-proof documentation."
  },
  {
    icon: FileText,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
    title: "Instant Translation",
    desc: "Dictate or type rough notes. The engine silently cross-references 2026 LCDs to generate perfect clinical narratives and HCPCS codes."
  },
  {
    icon: ShieldCheck,
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    title: "The \"Devil's Advocate\" Audit",
    desc: "Before you submit, run a Mock Audit. Our hostile AI auditor finds logical loopholes and missing criteria to prevent denials."
  },
  {
    icon: Mic,
    color: 'text-red-600',
    bg: 'bg-red-100',
    title: "Live Consultant",
    desc: "Driving to a patient's home? Use the Live Audio mode to prepare for the visit or conduct a structured interview hands-free."
  }
];

const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose, onRunDemo }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      finish();
    }
  };

  const finish = (runDemo = false) => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      if (runDemo) onRunDemo();
    }, 300);
  };

  const StepIcon = STEPS[currentStep].icon;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Progress Bar */}
        <div className="h-1 w-full bg-slate-100">
          <div 
            className="h-full bg-blue-600 transition-all duration-500 ease-out" 
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-8 flex flex-col items-center text-center pt-12">
          {/* Icon Animation Wrapper */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors duration-500 ${STEPS[currentStep].bg}`}>
            <StepIcon className={`w-10 h-10 ${STEPS[currentStep].color} transition-all duration-500 transform`} />
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-3 transition-all duration-300">
            {STEPS[currentStep].title}
          </h2>
          
          <p className="text-slate-500 leading-relaxed mb-8 h-20">
            {STEPS[currentStep].desc}
          </p>

          <div className="flex gap-3 w-full">
            {currentStep === STEPS.length - 1 ? (
              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={() => finish(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                   <Sparkles className="w-4 h-4" />
                   Start with a Demo Case
                </button>
                <button
                  onClick={() => finish(false)}
                  className="text-sm text-slate-400 hover:text-slate-600 font-medium py-2"
                >
                  Skip, I'll explore myself
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => finish(false)}
                  className="flex-1 py-3.5 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleNext}
                  className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Step Dots */}
        <div className="bg-slate-50 py-4 flex justify-center gap-2 border-t border-slate-100">
          {STEPS.map((_, i) => (
            <div 
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentStep ? 'bg-blue-600 w-4' : 'bg-slate-300'
              }`} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
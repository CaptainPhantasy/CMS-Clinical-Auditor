import { GoogleGenAI, Type, LiveServerMessage, Modality } from "@google/genai";
import { GroundingChunk, TranslationResult, MockAuditResult, ImageAttachment } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// System Instructions
const TRANSLATOR_SYSTEM_INSTRUCTION = `Role: You are a strict, highly accurate Medicare/Medicaid compliance auditor and translation engine. Your sole purpose is to convert a medical professional's natural language clinical observations (and optional visual evidence from photos) into universally compliant CMS documentation for Durable Medical Equipment (DME).

Operational Rules:
1. Mandatory Verification: You must silently search the web for the most current 2026 CMS Local Coverage Determinations (LCDs) and Medicare Benefit Policy Manual requirements for the specific equipment mentioned.
2. Strict Terminology: Translate informal notes into exact Medicare verbiage.
3. Visual Evidence Integration: If an image is provided, analyze it for objective clinical data (e.g., "doorway width narrow," "steps at entry," "edema present") and explicitly cite this "visual evidence" in the documentation.
4. Defensive Documentation: Ensure the output addresses all baseline requirements (rule out lower-level equipment, confirm in-home use, physical/cognitive ability).
5. Electronic Visit Verification (EVV): If EVV metadata (Timestamp, Location, Duration) is provided, you MUST append a formal legal footer at the very bottom of the document to prove the Face-to-Face requirement was met.
   Format:
   "**Face-to-Face Evaluation Verified:**
   Date: [Date]
   Time: [Time]
   Duration: [Duration] minutes
   Location Coordinates: [Lat, Long]
   Status: Electronic verification data secured at point of care."

Output Format (Strictly follow this structure):
**Recommended HCPCS Code:** [Insert Code and Device Name]

**CMS-Compliant Clinical Documentation:**
[Draft the finalized clinical note here in a professional, bureaucratic 3rd-person medical tone. Seamlessly integrate the exact mandatory CMS phrasing required for approval.]

**CMS Compliance Checklist:**
- [ ] [Mandatory Criterion 1 met]
- [ ] [Mandatory Criterion 2 met]
- [ ] [Mandatory Criterion 3 met]

**Missing/Required Information:**
[If the user's prompt lacks crucial information, list the exact questions the practitioner must answer. If no information is missing, output 'None.']

[Insert EVV Footer Here if applicable]`;

const AUDIT_SYSTEM_INSTRUCTION = `Role: You are a hostile, "Devil's Advocate" Insurance Auditor whose goal is to DENY claims.
Task: Analyze the provided Clinical Documentation Draft. Find logical loopholes, weak phrasing, or missing exclusionary details that would allow you to deny the request.

Output JSON Format:
{
  "riskScore": "LOW" | "MEDIUM" | "HIGH",
  "auditorFeedback": "A brutal, direct explanation of why you would deny this claim or what makes it weak.",
  "missingCriteria": ["List of specific phrases or facts that MUST be added to prevent denial"]
}`;

/**
 * Translates clinical notes using Gemini 3 Pro with Thinking, Search Grounding, and Vision.
 */
export const translateClinicalNotes = async (
  input: string, 
  image?: ImageAttachment,
  evvMetadata?: { latitude: number; longitude: number; timestamp: string; duration: number }
): Promise<TranslationResult> => {
  try {
    const parts: any[] = [{ text: input }];
    
    // Add image part if present
    if (image) {
      parts.unshift({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data
        }
      });
    }

    // Add EVV Metadata
    if (evvMetadata) {
      parts.push({
        text: `\n\n[SYSTEM METADATA - DO NOT EDIT]\nEVV TIMESTAMP: ${evvMetadata.timestamp}\nEVV COORDINATES: ${evvMetadata.latitude.toFixed(5)}, ${evvMetadata.longitude.toFixed(5)}\nVISIT DURATION: ${Math.ceil(evvMetadata.duration)} minutes\nINSTRUCTION: Append the Face-to-Face Verification footer using this data.`
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction: TRANSLATOR_SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });

    const text = response.text || "No response generated.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;

    return { text, groundingChunks };
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};

/**
 * Runs a "Devil's Advocate" Mock Audit on the generated text.
 */
export const runMockAudit = async (clinicalNote: string): Promise<MockAuditResult> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Audit this clinical note for denial risks:\n\n${clinicalNote}`,
      config: {
        systemInstruction: AUDIT_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
            auditorFeedback: { type: Type.STRING },
            missingCriteria: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            }
          },
          required: ["riskScore", "auditorFeedback", "missingCriteria"]
        }
      }
    });

    const jsonText = response.text || "{}";
    return JSON.parse(jsonText) as MockAuditResult;
  } catch (error) {
    console.error("Audit error:", error);
    throw {
      riskScore: "HIGH",
      auditorFeedback: "System error during audit. Assume high risk and verify manually.",
      missingCriteria: ["Manual verification required"]
    };
  }
};

/**
 * Fetches real-time 2026 DME Guidelines using Search Grounding.
 */
export const fetchDMEGuidelines = async (dmeKeyword: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Identify the current 2026 CMS Local Coverage Determination (LCD) mandatory clinical requirements for: ${dmeKeyword}.
      
      Return a simple JSON Array of strings. Each string must be a concise, mandatory criterion (e.g., "O2 saturation ≤ 88%").
      Do not include conversational text.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
      },
    });
    
    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Guideline fetch error:", error);
    return ["Unable to load live guidelines. Please verify manually."];
  }
};

/**
 * Sends a message to the Chatbot Assistant.
 */
export const sendChatMessage = async (history: { role: string; parts: { text: string }[] }[], newMessage: string) => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      history: history,
      config: {
        systemInstruction: "You are a helpful CMS Compliance Assistant. Answer questions about Medicare guidelines, HCPCS codes, and documentation requirements.",
        tools: [{ googleSearch: {} }],
      }
    });

    const response = await chat.sendMessage({ message: newMessage });
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;

    return {
      text: response.text || "",
      groundingChunks
    };
  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
};

/**
 * Connects to the Live API for real-time voice consultation.
 */
export const connectLiveSession = async (
  onOpen: () => void,
  onMessage: (
    audioData: string | null, 
    transcript: { role: 'user' | 'model', text: string, isFinal: boolean } | null
  ) => void,
  onClose: () => void,
  onError: (e: Error) => void,
  topic?: string
) => {
  
  let systemInstruction = "You are a helpful medical compliance consultant. Listen to the doctor's questions about patient coverage or documentation and provide brief, accurate advice.";
  
  if (topic) {
    systemInstruction = `You are a Socratic Clinical Interviewer helping a Nurse Practitioner document medical necessity for: ${topic}.
GOAL: Ask short, focused questions one-by-one to gather 2026 CMS LCD criteria.
RULES:
1. Do not ask for everything at once. Ask one distinct question at a time.
2. Be conversational but efficient (she is driving).
3. Cover: ADL deficits, home environment, ruling out lower-level devices (cane/walker), and cognitive ability to use the device.
4. Once you have sufficient details, say: "I have enough information. Here is your synthesized clinical note:" and then dictate the full, formal CMS-compliant paragraph clearly and slowly so it can be transcribed.`;
  }

  const session = await ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    config: {
      systemInstruction: systemInstruction,
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
    callbacks: {
        onopen: onOpen,
        onmessage: (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data || null;
            
            // Handle Transcription
            let transcriptUpdate = null;
            
            // Model Output Transcription
            if (msg.serverContent?.outputTranscription) {
              transcriptUpdate = { 
                role: 'model', 
                text: msg.serverContent.outputTranscription.text, 
                isFinal: false 
              };
            }
            
            // User Input Transcription
            if (msg.serverContent?.inputTranscription) {
               transcriptUpdate = {
                 role: 'user',
                 text: msg.serverContent.inputTranscription.text,
                 isFinal: false
               };
            }
            
            // Turn Complete signals finality for the accumulated text
            if (msg.serverContent?.turnComplete) {
               transcriptUpdate = { role: 'turn_complete', text: '', isFinal: true } as any;
            }

            onMessage(audioData, transcriptUpdate as any);
        },
        onclose: onClose,
        onerror: (e) => onError(new Error(e.type)),
    }
  });
  return session;
};

// Helper for audio processing (Blob creation for Live API input)
export function createPcmBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return {
    data: base64,
    mimeType: 'audio/pcm;rate=16000',
  };
}
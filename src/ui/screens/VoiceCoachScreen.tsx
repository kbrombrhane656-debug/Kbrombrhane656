import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { useAppStore } from '../../data/store';
import { useTranslation } from '../../i18n';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const VoiceCoachScreen = () => {
  const { language } = useAppStore();
  const t = useTranslation(language);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  const startSession = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsRecording(true);
            
            // Setup audio capture
            const audioCtx = audioContextRef.current!;
            sourceRef.current = audioCtx.createMediaStreamSource(stream);
            processorRef.current = audioCtx.createScriptProcessor(4096, 1, 1);
            
            processorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // Convert Float32 to Int16
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                let s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              
              // Convert to base64
              const buffer = new ArrayBuffer(pcm16.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < pcm16.length; i++) {
                view.setInt16(i * 2, pcm16[i], true); // little endian
              }
              
              let binary = '';
              const bytes = new Uint8Array(buffer);
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64Data = btoa(binary);

              sessionPromise.then((session: any) => {
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };

            sourceRef.current.connect(processorRef.current);
            processorRef.current.connect(audioCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const binaryString = atob(base64Audio);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const int16Array = new Int16Array(bytes.buffer);
              const float32Array = new Float32Array(int16Array.length);
              for (let i = 0; i < int16Array.length; i++) {
                float32Array[i] = int16Array[i] / 32768.0;
              }
              
              playbackQueueRef.current.push(float32Array);
              playNextAudio();
            }
            
            if (message.serverContent?.interrupted) {
              playbackQueueRef.current = [];
            }
          },
          onerror: (err: any) => {
            console.error("Live API Error:", err);
            setError("Connection error. Please try again.");
            stopSession();
          },
          onclose: () => {
            stopSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are Gabeya Coach, a smart financial advisor for Ethiopian small business owners. Keep your answers short, practical, and encouraging. Focus on profit, expenses, and simple business tips.",
        },
      });

      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to start voice coach.");
      setIsConnecting(false);
    }
  };

  const playNextAudio = () => {
    if (isPlayingRef.current || playbackQueueRef.current.length === 0 || !audioContextRef.current) return;
    
    isPlayingRef.current = true;
    const audioData = playbackQueueRef.current.shift()!;
    const audioBuffer = audioContextRef.current.createBuffer(1, audioData.length, 24000); // Live API returns 24kHz
    audioBuffer.getChannelData(0).set(audioData);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      playNextAudio();
    };
    source.start();
  };

  const stopSession = () => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    if (processorRef.current && sourceRef.current) {
      sourceRef.current.disconnect();
      processorRef.current.disconnect();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setIsConnecting(false);
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <div className="p-5 flex flex-col h-full items-center justify-center bg-bg">
      <div className="text-center mb-12">
        <h2 className="text-[24px] font-bold text-primary mb-2">{t('gabeyaCoach')}</h2>
        <p className="text-[14px] text-secondary">{t('tapToTalk')}</p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] rounded-[12px] text-[13px] text-center max-w-xs">
          {error}
        </div>
      )}

      <button
        onClick={isRecording ? stopSession : startSession}
        disabled={isConnecting}
        className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
          isRecording 
            ? 'bg-expense shadow-[0_8px_16px_rgba(240,68,56,0.3)] animate-pulse' 
            : isConnecting
            ? 'bg-accent/80 shadow-[0_8px_16px_rgba(46,125,50,0.2)]'
            : 'bg-accent shadow-[0_8px_16px_rgba(46,125,50,0.3)] hover:opacity-90'
        }`}
      >
        {isConnecting ? (
          <Loader2 size={48} className="text-white animate-spin" />
        ) : isRecording ? (
          <Square size={48} className="text-white" />
        ) : (
          <Mic size={48} className="text-white" />
        )}
      </button>

      <div className="mt-8 h-8">
        {isConnecting && <p className="text-accent font-medium text-[14px] animate-pulse">{t('connecting')}</p>}
        {isRecording && <p className="text-accent font-medium text-[14px] animate-pulse">{t('listening')}</p>}
      </div>
    </div>
  );
};

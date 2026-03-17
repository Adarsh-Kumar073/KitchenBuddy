"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

// phase: "idle" | "listening" | "processing" | "speaking"

export default function VoicePage() {
  const [phase, setPhase] = useState("idle");
  const [messages, setMessages] = useState([]);

  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioBufferRef = useRef([]);
  const analyserRef = useRef(null);
  const intervalRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isActiveRef = useRef(false);
  const phaseRef = useRef("idle");

  const router = useRouter();

  // keep phaseRef in sync so callbacks always see latest phase
  const setPhaseSync = (p) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket setup
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
    wsRef.current = new WebSocket(wsUrl);
    wsRef.current.binaryType = "arraybuffer";

    wsRef.current.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "final_transcript") {
            setMessages((prev) => [...prev, { role: "user", text: data.text }]);

          } else if (data.type === "llm") {
            setMessages((prev) => [...prev, { role: "assistant", text: data.text }]);
            setPhaseSync("speaking");

          } else if (data.type === "assistant_done") {
            // audio playback onended will restart listening
            // this is a fallback in case no audio was sent
            if (isActiveRef.current && phaseRef.current === "speaking") {
              setPhaseSync("listening");
              startListeningCycle();
            }

          } else if (data.type === "error") {
            setMessages((prev) => [...prev, { role: "error", text: data.error }]);
            // resume listening even after error
            if (isActiveRef.current) {
              setPhaseSync("listening");
              startListeningCycle();
            }
          }
        } catch (err) {
          console.error("WebSocket parse error:", err);
        }
      } else {
        // binary = assistant audio — play it, then restart listening
        const blob = new Blob([event.data], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (isActiveRef.current) {
            setPhaseSync("listening");
            startListeningCycle();
          }
        };
        audio.play();
      }
    };

    return () => wsRef.current?.close();
  }, []);

  // start a single recording cycle (called repeatedly)
  const startListeningCycle = () => {
    if (!isActiveRef.current || !streamRef.current) return;

    clearInterval(intervalRef.current);
    audioBufferRef.current = [];

    const recorder = new MediaRecorder(streamRef.current, { mimeType: "audio/webm" });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioBufferRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      if (!isActiveRef.current) return;
      setPhaseSync("processing");

      const blob = new Blob(audioBufferRef.current, { type: "audio/webm" });
      const arrayBuffer = await blob.arrayBuffer();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(arrayBuffer);
        wsRef.current.send(JSON.stringify({ type: "end_speech" }));
      }
      audioBufferRef.current = [];
    };

    recorder.start(250); // collect data every 250ms so buffer is never empty
    intervalRef.current = setInterval(checkSilenceAndFlush, 5000);
  };

  // flush on silence
  const checkSilenceAndFlush = () => {
    if (phaseRef.current !== "listening") return;
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const val = (dataArray[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    if (rms < 0.02) {
      clearInterval(intervalRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }
  };

  // start the whole session
  const startSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      analyserRef.current = ctx.createAnalyser();
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 2048;

      isActiveRef.current = true;
      setPhaseSync("listening");
      startListeningCycle();
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  // stop the whole session
  const stopSession = () => {
    isActiveRef.current = false;
    clearInterval(intervalRef.current);

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setPhaseSync("idle");
  };

  const phaseConfig = {
    idle: {
      btnColor: "bg-orange-500 hover:bg-orange-600",
      btnLabel: "Tap to start",
      indicator: null,
      icon: "/microphone.png",
    },
    listening: {
      btnColor: "bg-red-500 hover:bg-red-600 scale-110",
      btnLabel: "Tap to end session",
      indicator: { dot: "bg-green-500", text: "Listening...", textColor: "text-green-600" },
      icon: "/microphone.png",
    },
    processing: {
      btnColor: "bg-yellow-500 scale-105 opacity-80",
      btnLabel: "Processing...",
      indicator: { dot: "bg-yellow-500", text: "Thinking...", textColor: "text-yellow-600" },
      icon: "/mute.png",
    },
    speaking: {
      btnColor: "bg-blue-500 scale-105",
      btnLabel: "Tap to end session",
      indicator: { dot: "bg-blue-500", text: "Speaking...", textColor: "text-blue-600" },
      icon: "/mute.png",
    },
  };

  const cfg = phaseConfig[phase];

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-gray-900 text-white px-6 py-4 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => router.push("/")}
          className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-orange-400 font-semibold">KitchenBuddy</span>
        <span className="text-gray-400 text-sm">— Voice Mode</span>
        {phase !== "idle" && (
          <span className={`ml-auto text-xs font-medium px-2 py-1 rounded-full ${
            phase === "listening" ? "bg-green-900 text-green-300" :
            phase === "processing" ? "bg-yellow-900 text-yellow-300" :
            "bg-blue-900 text-blue-300"
          }`}>
            {phase === "listening" ? "● Live" : phase === "processing" ? "⟳ Thinking" : "♪ Speaking"}
          </span>
        )}
      </div>

      {/* Cold-start notice */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-start gap-2 flex-shrink-0">
        <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
        <p className="text-xs text-amber-700 leading-relaxed">
          The voice server is hosted on <span className="font-semibold">Render free tier</span> — it may take <span className="font-semibold">2–3 minutes</span> to wake up on the first response. Subsequent responses will be faster.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-8">
              <div className="text-4xl mb-3">🎙️</div>
              <p className="font-medium">Tap the button to start a voice conversation</p>
              <p className="text-xs mt-1">The assistant will listen, respond, and keep listening automatically</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm flex-shrink-0 mt-0.5">
                  🍳
                </div>
              )}
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : m.role === "error"
                  ? "bg-red-100 text-red-700 rounded-bl-sm"
                  : "bg-white text-gray-800 rounded-bl-sm shadow-sm"
              }`}>
                {m.text}
              </div>
              {m.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-bold flex-shrink-0 mt-0.5">
                  You
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 flex flex-col items-center gap-3 border-t border-gray-200 bg-white flex-shrink-0">
        {cfg.indicator && (
          <div className={`flex items-center gap-2 text-sm font-medium ${cfg.indicator.textColor}`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${cfg.indicator.dot}`} />
            {cfg.indicator.text}
          </div>
        )}

        <button
          onClick={phase === "idle" ? startSession : stopSession}
          disabled={phase === "processing"}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg cursor-pointer disabled:cursor-not-allowed ${cfg.btnColor}`}
          aria-label={cfg.btnLabel}
        >
          <Image src={cfg.icon} alt="mic" width={28} height={28} />
        </button>

        <p className="text-xs text-gray-400">{cfg.btnLabel}</p>
      </div>
    </div>
  );
}

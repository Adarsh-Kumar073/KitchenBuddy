"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

export default function HomePage() {
  const [recording, setRecording] = useState(false);
  const [messages, setMessages] = useState([]);
  const [speakingIndicator, setSpeakingIndicator] = useState(""); 
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioBufferRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    wsRef.current = new WebSocket("ws://localhost:8000/ws");
    wsRef.current.binaryType = "arraybuffer";

    wsRef.current.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "final_transcript") {
            setMessages((prev) => [...prev, `✅ ${data.text}`]);
          } 
          else if (data.type === "llm") {
            setMessages((prev) => [...prev, `🤖 ${data.text}`]);
          } 
          else if (data.type === "error") {
            setMessages((prev) => [...prev, `❌ ${data.error}`]);
          }
        } catch (err) {
          console.error("Failed to parse JSON:", err);
        }
      } else {
        const blob = new Blob([event.data], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        new Audio(url).play();
      }
    };

    return () => wsRef.current?.close();
  }, []);

  const startListening = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContextRef.current = new AudioContext();
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);

    analyserRef.current = audioContextRef.current.createAnalyser();
    sourceRef.current.connect(analyserRef.current);
    analyserRef.current.fftSize = 2048;

    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/webm" });
    audioBufferRef.current = [];

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) audioBufferRef.current.push(event.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(audioBufferRef.current, { type: "audio/webm" });
      const arrayBuffer = await blob.arrayBuffer();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(arrayBuffer);
        wsRef.current.send(JSON.stringify({ type: "end_speech" }));
      }
      audioBufferRef.current = [];
      setSpeakingIndicator("🎤 Listening...");
      // restart automatically
      mediaRecorderRef.current.start();
    };

    mediaRecorderRef.current.start();
    setRecording(true);
    setSpeakingIndicator("🎤 Listening...");

    // check silence every 2 seconds
    intervalRef.current = setInterval(checkSilenceAndFlush, 5000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    clearInterval(intervalRef.current);
    setSpeakingIndicator("");
    setRecording(false);
  };

  const checkSilenceAndFlush = () => {
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const val = (dataArray[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    if (rms < 0.02) {
      console.log("🤫 Silence detected in last 2s -> flush to backend");
      stopRecording(); // will trigger onstop -> send audio -> restart
    } else {
      console.log("🎤 Still speaking in last 2s");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4 p-4">
      <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center">
        <Image
          src={recording ? "/microphone.png" : "/mute.png"}
          alt="mic"
          width={40}
          height={40}
        />
      </div>

      <button
        className="p-3 bg-blue-600 text-white rounded-lg"
        onClick={recording ? stopRecording : startListening}
      >
        {recording ? "Stop" : "Click here to Speak"}
      </button>


      <div className="mt-4 w-full max-w-md bg-gray-100 p-3 rounded-lg h-64 overflow-y-auto">
        {messages.map((m, i) => (
          <p key={i} className="text-sm text-gray-700 mb-1">{m}</p>
        ))}
      </div>
    </div>
  );
}

// backend/index.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import { spawn } from "child_process";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ----------------- PATH SETUP -----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!fs.existsSync(path.join(__dirname, "tmp"))) {
  fs.mkdirSync(path.join(__dirname, "tmp"));
}

// ----------------- APP SETUP -----------------
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Gemini API
const genAI = new GoogleGenerativeAI("YOUR_API_KEY_HERE");

// --- FasterWhisper via Python ---
function runFasterWhisper(filePath) {
  return new Promise((resolve, reject) => {
    const code = `
import json
from faster_whisper import WhisperModel

model = WhisperModel("base", device="cpu", compute_type="int8")
segments, info = model.transcribe(r"${filePath}")

result = {
    "language": info.language,
    "segments": [
        {"start": seg.start, "end": seg.end, "text": seg.text}
        for seg in segments
    ]
}
print(json.dumps(result))
`;

    const python = spawn("python", ["-c", code]);

    let output = "";
    python.stdout.on("data", (data) => (output += data.toString()));
    python.stderr.on("data", (data) =>
      console.error("Whisper error:", data.toString())
    );

    python.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          const transcript = result.segments.map((seg) => seg.text).join(" ").trim();
          resolve(transcript);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`Whisper exited with code ${code}`));
      }
    });
  });
}

// --- Coqui TTS Worker ---
let coquiProcess;
const PYTHON_PATH = path.join(__dirname, "venv", "Scripts", "python.exe");

function startCoqui() {
  coquiProcess = spawn(PYTHON_PATH, [path.join(__dirname, "coqui_worker.py")], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  coquiProcess.stderr.on("data", (data) =>
    console.error("Coqui error:", data.toString())
  );
}

startCoqui();

function runCoquiTTS(text) {
  return new Promise((resolve, reject) => {
    const msg = JSON.stringify({ text }) + "\n";
    coquiProcess.stdin.write(msg);

    const onData = (data) => {
      try {
        const output = JSON.parse(data.toString());
        if (output.audio) {
          const audioBuffer = Buffer.from(output.audio, "base64");
          coquiProcess.stdout.off("data", onData);
          resolve(audioBuffer);
        } else {
          reject(new Error(output.error || "Unknown Coqui error"));
        }
      } catch (err) {
        reject(err);
      }
    };

    coquiProcess.stdout.on("data", onData);
  });
}

// --- Gemini LLM ---
async function runGemini(history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Gemini expects roles: "user" | "model" | "system" | "function"
  const chat = model.startChat({
    history: history
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role === "assistant" ? "model" : msg.role,
        parts: [{ text: msg.content }],
      })),
  });

  const lastUserMessage = history[history.length - 1].content;
  const result = await chat.sendMessage(lastUserMessage);
  return result.response.text();
}

// --- WebSocket Handler ---
wss.on("connection", (ws) => {
  console.log("✅ Client connected");

  const history = [
    {
      role: "user",
      content: `You are a friendly cooking assistant. Always give clear step-by-step instructions,
      suggest substitutions, mention durations, and keep it conversational. Don't use any type of symbol and short forms.
      Always start with "Hello!". Provide only 1 step at a time and in the end of every response ask if the user wants to continue.`,
    },
  ];

  ws.on("message", async (message) => {
    if (Buffer.isBuffer(message)) {
      const inputAudio = path.join(__dirname, "tmp", `in-${Date.now()}.wav`);
      fs.writeFileSync(inputAudio, message);

      try {
        // 1️⃣ Transcribe with FasterWhisper
        const transcript = await runFasterWhisper(inputAudio);
        console.log("📝 Transcript:", transcript);
        history.push({ role: "user", content: transcript });
        ws.send(JSON.stringify({ type: "transcript", text: transcript }));

        // 2️⃣ Gemini LLM
        const response = await runGemini(history);
        history.push({ role: "assistant", content: response });
        ws.send(JSON.stringify({ type: "llm", text: response }));

        // 3️⃣ Coqui TTS
        const audioBuffer = await runCoquiTTS(response);
        ws.send(audioBuffer); // Send WAV to frontend
      } catch (err) {
        console.error("❌ Error:", err);
        ws.send(JSON.stringify({ type: "error", error: err.message }));
      } finally {
        if (fs.existsSync(inputAudio)) fs.unlinkSync(inputAudio);
      }
    }
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected");
  });
});

server.listen(3001, () => {
  console.log("🚀 Voice server running on ws://localhost:3001");
});

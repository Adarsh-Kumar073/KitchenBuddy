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

// Gemini
const genAI = new GoogleGenerativeAI("AIzaSyDmE15ZCUF_dY6A3lJ0ZxrHHNLguSXvJ1Y");

// Paths for models/scripts
const piperServerScript = path.join(__dirname, "piper-server.py");
const piperModelPath = path.join(__dirname, "piper-model", "en_US-libritts-high.onnx");

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
    python.stderr.on("data", (data) => console.error("Whisper error:", data.toString()));

    python.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          // Join all segment texts for a single transcript
          const transcript = result.segments.map(seg => seg.text).join(" ").trim();
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

// --- Piper via Python ---
function runPiper(text, outputFile) {
  return new Promise((resolve, reject) => {
    const python = spawn("python", [piperServerScript, text, outputFile, piperModelPath]);

    python.stdout.on("data", (data) => console.log(data.toString()));
    python.stderr.on("data", (data) => console.error("Piper error:", data.toString()));

    python.on("close", (code) => {
      if (code === 0) {
        const audioBuffer = fs.readFileSync(outputFile);
        fs.unlinkSync(outputFile);
        resolve(audioBuffer);
      } else {
        reject(new Error(`Piper exited with code ${code}`));
      }
    });
  });
}

// --- Gemini LLM ---
async function runGemini(history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Google Generative AI expects "user" and "model" roles only
  const fixedHistory = history.map((msg, idx) => {
    let role = msg.role;
    if (role === "system") {
      // convert system to user instruction (Gemini requirement)
      role = "user";
    } else if (role === "assistant") {
      role = "model";
    }
    return { role, parts: [{ text: msg.content }] };
  });

  // Use chat session with converted history
  const chat = model.startChat({ history: fixedHistory });

  const lastUserMessage = history[history.length - 1].content;
  const result = await chat.sendMessage(lastUserMessage);

  return result.response.text();
}


// --- WebSocket Handler ---
wss.on("connection", (ws) => {
  console.log("✅ Client connected");

  const history = [
    {
      role: "system",
      content: `You are a friendly cooking assistant. Always give clear step-by-step instructions,
      suggest substitutions, mention durations, and keep it conversational.`,
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

        // 3️⃣ Piper TTS
        const outputWav = path.join(__dirname, "tmp", `out-${Date.now()}.wav`);
        const audioBuffer = await runPiper(response, outputWav);
        ws.send(audioBuffer);
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

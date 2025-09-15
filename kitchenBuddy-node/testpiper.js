import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to your local Piper model
const piperModelPath = path.join(__dirname, "piper-model", "en_US-libritts-high.onnx");

// Python helper script (runs as a persistent server)
const pythonServerScript = path.join(__dirname, "piper-server.py");

// Function to generate audio from text
function generateAudio(text, outputFile) {
  return new Promise((resolve, reject) => {
    const python = spawn("python", [pythonServerScript, text, outputFile, piperModelPath]);

    python.stdout.on("data", (data) => console.log(data.toString()));
    python.stderr.on("data", (data) => console.error("Python error:", data.toString()));

    python.on("close", (code) => {
      if (code === 0) {
        const audioBuffer = fs.readFileSync(outputFile);
        resolve(audioBuffer);
      } else {
        reject(new Error(`Python exited with code ${code}`));
      }
    });
  });
}

// Example usage
(async () => {
  try {
    const audio1 = await generateAudio("Hello, this is the first test.", path.join(__dirname, "out1.wav"));
    fs.writeFileSync("final_out1.wav", audio1);

    const audio2 = await generateAudio("And this is the second test.", path.join(__dirname, "out2.wav"));
    fs.writeFileSync("final_out2.wav", audio2);

    console.log("Audio generated successfully!");
  } catch (err) {
    console.error("Error generating audio:", err);
  }
})();

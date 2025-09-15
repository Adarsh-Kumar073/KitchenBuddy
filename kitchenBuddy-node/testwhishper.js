import { spawn } from "child_process";
import path from "path";

const audioFile = path.join(process.cwd(), "samples_jfk.wav");

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
    python.stderr.on("data", (data) => console.error("Python error:", data.toString()));

    python.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output); // ✅ now valid JSON
          resolve(result);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`Python exited with code ${code}`));
      }
    });
  });
}

runFasterWhisper(audioFile)
  .then((result) => console.log("Transcription:", result))
  .catch((err) => console.error("Error:", err));

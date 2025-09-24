import os
import asyncio
import json
import tempfile
from io import BytesIO

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from faster_whisper import WhisperModel
from gtts import gTTS
import google.generativeai as genai

# === Configuration ===
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"  # Replace with your actual Gemini API key

# === Initialize Gemini ===
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel("gemini-1.5-flash")

# === FastAPI app ===
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Load Whisper model once ===
whisper_model = WhisperModel("base", device="cpu", compute_type="int8")

# === Helper: synthesize text via gTTS ===
async def synthesize_text(text: str) -> bytes:
    """
    Generate speech bytes from text using gTTS (MP3 format).
    """
    try:
        tts = gTTS(text=text, lang='en', slow= False)
        audio_bytes_io = BytesIO()
        tts.write_to_fp(audio_bytes_io)
        audio_bytes_io.seek(0)
        return audio_bytes_io.read()
    except Exception as e:
        raise RuntimeError(f"gTTS error: {e}")

# === Real Gemini call ===
async def run_gemini(history: list) -> str:
    try:
        prompt = "\n".join([f"{m['role']}: {m['content']}" for m in history])
        response = gemini_model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"[Gemini error: {e}]"

# === WebSocket endpoint ===
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    print("[INFO] Client connected")

    history = [
        {
            "role": "system",
            "content": (
                "You are a friendly cooking assistant. "
                "Always give clear step-by-step instructions, suggest substitutions, "
                "mention durations, and keep it conversational. "
                "Don't use symbols and special characters ,do not use the symbol *"
                "Start with Hello! Provide only one step at a time and "
                "at the end ask if the user wants to proceed further."
                "don't not use step number "
                " you should provide ingridients to be used"
            ),
        }
    ]

    tmp_wav = None
    last_sent_transcript = ""

    try:
        while True:
            data = await ws.receive()

            # === Binary (audio chunks) ===
            if "bytes" in data:
                chunk = data["bytes"]
                if tmp_wav is None:
                    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".webm")
                    os.close(tmp_fd)
                    tmp_wav = tmp_path
                with open(tmp_wav, "ab") as f:
                    f.write(chunk)

                try:
                    segments, info = whisper_model.transcribe(tmp_wav)
                    partial = " ".join([seg.text for seg in segments]).strip()
                except Exception as ex:
                    print("Whisper error (partial):", ex)
                    partial = ""

                if partial and partial != last_sent_transcript:
                    last_sent_transcript = partial
                    await ws.send_text(json.dumps({"type": "partial_transcript", "text": partial}))

            # === Text messages (control) ===
            elif "text" in data:
                try:
                    msg = json.loads(data["text"])
                except Exception:
                    continue

                mtype = msg.get("type")

                if mtype == "end_speech":
                    final_transcript = last_sent_transcript or ""
                    if tmp_wav:
                        try:
                            segments, info = whisper_model.transcribe(tmp_wav)
                            final_transcript = " ".join([seg.text for seg in segments]).strip()
                        except Exception as ex:
                            print("Whisper error (final):", ex)

                    await ws.send_text(json.dumps({"type": "final_transcript", "text": final_transcript}))
                    history.append({"role": "user", "content": final_transcript})

                    # Run Gemini
                    llm_text = await run_gemini(history)
                    history.append({"role": "assistant", "content": llm_text})
                    await ws.send_text(json.dumps({"type": "llm", "text": llm_text}))

                    # Run TTS using gTTS
                    try:
                        audio_bytes = await synthesize_text(llm_text)
                        await ws.send_bytes(audio_bytes)
                    except Exception as e:
                        await ws.send_text(json.dumps({"type": "error", "error": f"TTS error: {e}"}))

                    # Cleanup
                    if tmp_wav and os.path.exists(tmp_wav):
                        os.remove(tmp_wav)
                    tmp_wav = None
                    last_sent_transcript = ""

                elif mtype == "stop":
                    await ws.close()
                    break

                elif mtype == "ping":
                    await ws.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        print("[INFO] Client disconnected")
    except Exception as e:
        print("[ERROR] WebSocket error:", e)
        try:
            await ws.send_text(json.dumps({"type": "error", "error": str(e)}))
        except:
            pass
    finally:
        if tmp_wav and os.path.exists(tmp_wav):
            os.remove(tmp_wav)

# === Run server ===
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

import os
import asyncio
import json
import tempfile
from io import BytesIO

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import edge_tts
from groq import Groq

load_dotenv()

# === Configuration ===
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is not set. Add it to your .env file.")

# === Initialize Groq ===
groq_client = Groq(api_key=GROQ_API_KEY)

# === FastAPI app ===
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Helper: synthesize text via edge-tts ===
async def synthesize_text(text: str) -> bytes:
    try:
        communicate = edge_tts.Communicate(text, voice="en-US-AriaNeural")
        audio_bytes_io = BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_bytes_io.write(chunk["data"])
        audio_bytes_io.seek(0)
        return audio_bytes_io.read()
    except Exception as e:
        raise RuntimeError(f"edge-tts error: {e}")

# === Groq LLM call ===
async def run_llm(history: list) -> str:
    try:
        response = await asyncio.to_thread(
            groq_client.chat.completions.create,
            model="llama-3.1-8b-instant",
            messages=history,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"[Groq error: {e}]"

# === Groq Whisper transcription ===
async def transcribe_audio(file_path: str) -> str:
    try:
        with open(file_path, "rb") as f:
            result = await asyncio.to_thread(
                groq_client.audio.transcriptions.create,
                file=("audio.webm", f),
                model="whisper-large-v3-turbo",
            )
        return result.text.strip()
    except Exception as e:
        print(f"Groq Whisper error: {e}")
        return ""

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
                "Don't use symbols and special characters, do not use the symbol *. "
                "Start with Hello! Provide only one step at a time and "
                "at the end ask if the user wants to proceed further. "
                "Do not use step numbers. "
                "You should provide ingredients to be used. "
                "You don't have to provide the recipe until user asks for it."
            ),
        }
    ]

    tmp_wav = None

    try:
        while True:
            data = await ws.receive()

            # === Binary (audio chunks) — just accumulate ===
            if "bytes" in data:
                chunk = data["bytes"]
                if tmp_wav is None:
                    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".webm")
                    os.close(tmp_fd)
                    tmp_wav = tmp_path
                with open(tmp_wav, "ab") as f:
                    f.write(chunk)

            # === Text messages (control) ===
            elif "text" in data:
                try:
                    msg = json.loads(data["text"])
                except Exception:
                    continue

                mtype = msg.get("type")

                if mtype == "end_speech":
                    # Transcribe with Groq Whisper
                    final_transcript = ""
                    if tmp_wav and os.path.exists(tmp_wav):
                        final_transcript = await transcribe_audio(tmp_wav)

                    # Cleanup temp file
                    if tmp_wav and os.path.exists(tmp_wav):
                        os.remove(tmp_wav)
                    tmp_wav = None

                    # If nothing was said, skip and resume listening
                    if not final_transcript:
                        await ws.send_text(json.dumps({"type": "assistant_done"}))
                        continue

                    await ws.send_text(json.dumps({"type": "final_transcript", "text": final_transcript}))
                    history.append({"role": "user", "content": final_transcript})

                    # Run Groq LLM
                    llm_text = await run_llm(history)
                    history.append({"role": "assistant", "content": llm_text})
                    await ws.send_text(json.dumps({"type": "llm", "text": llm_text}))

                    # Run TTS
                    try:
                        audio_bytes = await synthesize_text(llm_text)
                        await ws.send_bytes(audio_bytes)
                        await ws.send_text(json.dumps({"type": "assistant_done"}))
                    except Exception as e:
                        await ws.send_text(json.dumps({"type": "error", "error": f"TTS error: {e}"}))
                        await ws.send_text(json.dumps({"type": "assistant_done"}))

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
        except Exception:
            pass
    finally:
        if tmp_wav and os.path.exists(tmp_wav):
            os.remove(tmp_wav)

# === Run server ===
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

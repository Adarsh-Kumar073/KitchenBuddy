import sys
import json
import base64
import io
import soundfile as sf
from TTS.api import TTS

# Load Coqui TTS model once
# You can replace "tts_models/en/ljspeech/tacotron2-DDC" with another voice model
tts = TTS("tts_models/en/ljspeech/tacotron2-DDC", progress_bar=False, gpu=False)

def synthesize(text: str) -> str:
    """Generate speech and return base64-encoded WAV."""
    with io.BytesIO() as buffer:
        # Generate WAV audio in-memory
        tts.tts_to_file(text=text, file_path=None, speaker=None, language=None, out_path=buffer)
        buffer.seek(0)
        audio_bytes = buffer.read()
        return base64.b64encode(audio_bytes).decode("utf-8")

# Continuously read requests from Node.js (stdin)
for line in sys.stdin:
    try:
        data = json.loads(line.strip())
        text = data.get("text", "")
        if not text:
            response = {"error": "No text provided"}
        else:
            audio_b64 = synthesize(text)
            response = {"audio": audio_b64}
    except Exception as e:
        response = {"error": str(e)}

    sys.stdout.write(json.dumps(response) + "\n")
    sys.stdout.flush()

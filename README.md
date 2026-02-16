# 🌸 Aira - Your Voice-Enabled AI Assistant

[![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

Aira is a **privacy-first, voice-enabled AI assistant** that runs entirely on your local machine. Speak naturally to interact with a powerful language model, with optional emotion-aware responses using your camera.

![Aira Demo](docs/demo.png)

## ✨ Features

- 🎙️ **Voice-First Interface** - Just speak naturally, no typing required
- 🔒 **100% Local & Private** - All AI models run on your device, no data leaves your machine
- 📷 **Emotion-Aware** (Optional) - Camera detects your emotional state to adapt responses
- ⚡ **Lightning Fast** - Local LLM inference for instant responses
- 🎨 **Beautiful UI** - Modern, responsive interface with dark/light mode
- 💬 **Chat History** - Conversations are saved locally
- 🎙️ **Text-to-Speech** - Aira speaks responses back to you

## 🏗️ Architecture

Aira consists of three main components:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React Frontend │────▶│   Rust Backend   │────▶│  Local AI Models│
│   (TypeScript)   │     │   (Axum Server)  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  🎤 Whisper STT  │
                        │  🧠 LLM (Qwen)   │
                        │  🔊 Piper TTS    │
                        └──────────────────┘
```

### Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | React + TypeScript + Vite + Bootstrap |
| **Backend** | Rust + Axum + Tokio |
| **Speech-to-Text** | Whisper (OpenAI) |
| **LLM** | Qwen2.5 via llama.cpp |
| **Text-to-Speech** | Piper |
| **Computer Vision** | MediaPipe Face Landmarker |

## 🚀 Quick Start

### Prerequisites

- **Rust** (1.70+) with Cargo
- **Node.js** (18+) with npm
- **FFmpeg** (for audio conversion)
- **CUDA** (optional, for GPU acceleration)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/aira.git
cd aira
```

### 2. Download AI Models

Create the models directory and download the required models:

```bash
mkdir -p aira/models
mkdir -p aira/tts_models

# Download Whisper model (Small English)
wget -O aira/models/ggml-small.en-q5_1.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin

# Download LLM model (Qwen2.5 3B)
wget -O aira/models/qwen2.5-3b-instruct-q4_0.gguf \
  https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_0.gguf

# Download Piper TTS model
wget -O aira/tts_models/en_US-hfc_female-medium.onnx \
  https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx

wget -O aira/tts_models/en_US-hfc_female-medium.onnx.json \
  https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json
```

### 3. Build & Run Backend

```bash
cd aira

# Build release version
cargo build --release

# Start the server
./target/release/aira_server
```

The server will start on `http://127.0.0.1:3000`

### 4. Build & Run Frontend

```bash
cd aira/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 5. Start Chatting!

Open your browser to `http://localhost:5173` and click **"Start Chatting"** to begin!

## 📖 Usage

### Voice Mode

1. Click the **camera icon** in the input area to enable camera
2. Grant microphone access when prompted
3. Speak naturally - Aira will transcribe and respond
4. Toggle **Live Mode** for continuous conversation

### Text Mode

1. Type your message in the input field
2. Press **Enter** or click the send button
3. Aira will respond with text and optional voice

### Camera & Emotion Detection

- Camera is **completely optional** - Aira works great without it
- If enabled, only numerical emotion data is sent (fatigue, engagement, stress)
- No video or images are ever transmitted
- All processing happens locally in your browser

## 🛠️ Development

### Project Structure

```
aira/
├── aira_brain/          # Core Rust library (STT, LLM, TTS)
│   └── src/
│       ├── lib.rs
│       ├── aira.rs      # Main Aira struct
│       ├── llm.rs       # LLM engine
│       ├── stt.rs       # Speech-to-text
│       ├── tts.rs       # Text-to-speech
│       └── emotion.rs   # Emotion analysis
│
├── aira_server/         # HTTP server (Axum)
│   └── src/
│       ├── main.rs
│       └── api/
│           ├── chat.rs      # Chat endpoint
│           ├── stt.rs       # Transcription
│           ├── tts.rs       # Synthesis
│           └── camera.rs    # Emotion from camera
│
├── frontend/            # React web UI
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── Landing.tsx
│       │   ├── Chat.tsx
│       │   ├── Sidebar.tsx
│       │   ├── CameraSensor.tsx
│       │   └── PrivacyModal.tsx
│       └── api/
│           ├── chatAPI.ts
│           └── storageAPI.ts
│
└── src/                 # CLI application
    └── main.rs
```

### Available Scripts

**Backend:**
```bash
cargo build --release          # Build release
cargo run -p aira_server       # Run server
cargo test                     # Run tests
cargo clippy                   # Lint code
```

**Frontend:**
```bash
npm run dev        # Development server
npm run build      # Production build
npm run preview    # Preview production build
```

### Environment Variables

Create `.env` in `aira/` directory:

```env
# Server configuration
AIRA_HOST=127.0.0.1
AIRA_PORT=3000

# Model paths
WHISPER_MODEL=models/ggml-small.en-q5_1.bin
LLM_MODEL=models/qwen2.5-3b-instruct-q4_0.gguf
TTS_MODEL=tts_models/en_US-hfc_female-medium.onnx

# Optional: GPU settings
USE_CUDA=true
```

## 🔧 Troubleshooting

### "No audio data received" error
- Ensure microphone permissions are granted in your browser
- Check that FFmpeg is installed: `ffmpeg -version`

### Slow responses
- Enable CUDA for GPU acceleration
- Use a smaller LLM model (e.g., 1B instead of 3B)
- Close other resource-intensive applications

### Camera not working
- Camera requires HTTPS in production (localhost is fine for development)
- Ensure camera permissions are granted
- Try refreshing the page after granting permissions

### Build errors
```bash
# Clean and rebuild
cargo clean
cargo build --release

# Update dependencies
cargo update
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) - Speech recognition
- [llama.cpp](https://github.com/ggerganov/llama.cpp) - LLM inference
- [Piper](https://github.com/rhasspy/piper) - Text-to-speech
- [MediaPipe](https://mediapipe.dev/) - Face detection and emotion analysis
- [Qwen](https://github.com/QwenLM/Qwen) - Large language model

## 📬 Contact

For questions or support, please open an issue on GitHub.

---

**Made with 💜 by the Aira Team**

*Speak naturally. Stay private. Get answers.*

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

- **Rust** (1.70+) with Cargo - [Install](https://www.rust-lang.org/tools/install)
- **Node.js** (18+) with npm - [Install](https://nodejs.org/)
- **FFmpeg** (for audio conversion) - See platform-specific instructions below
- **CUDA** (optional, for GPU acceleration)

### 💻 Platform-Specific Installation

<details>
<summary><b>🐧 Linux / macOS</b></summary>

#### Install FFmpeg:
```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y ffmpeg

# Fedora
sudo dnf install -y ffmpeg

# macOS (with Homebrew)
brew install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```

#### Run installer:
```bash
git clone https://github.com/yourusername/aira.git
cd aira
./install.sh
```
</details>

<details>
<summary><b>🪟 Windows</b></summary>

#### 1. Install Prerequisites

**FFmpeg:**
```powershell
# Using winget (Windows 10/11)
winget install Gyan.FFmpeg

# Or download manually from https://ffmpeg.org/download.html
# Extract to C:\ffmpeg and add C:\ffmpeg\bin to your PATH
```

**Rust:**
Download and run the installer from https://rustup.rs/

**Node.js:**
Download from https://nodejs.org/ (LTS version recommended)

#### 2. Clone Repository
```powershell
git clone https://github.com/yourusername/aira.git
cd aira
```

#### 3. Download Models Manually

Since the install script is bash-based, Windows users need to download models manually:

```powershell
# Create directories
mkdir -p aira\models
mkdir -p aira\tts_models

# Download Whisper model (using PowerShell)
Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin" -OutFile "aira\models\ggml-small.en-q5_1.bin"

# Download LLM model (Qwen2.5 3B)
Invoke-WebRequest -Uri "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_0.gguf" -OutFile "aira\models\qwen2.5-3b-instruct-q4_0.gguf"

# Download Piper TTS model
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx" -OutFile "aira\tts_models\en_US-hfc_female-medium.onnx"

Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json" -OutFile "aira\tts_models\en_US-hfc_female-medium.onnx.json"
```

#### 4. Build & Run

```powershell
# Build backend
cd aira
cargo build --release

# Install frontend dependencies
cd frontend
npm install

# Start servers (in separate terminals)
# Terminal 1 - Backend:
cd aira
.\target\release\aira_server.exe

# Terminal 2 - Frontend:
cd aira\frontend
npm run dev
```

Then open your browser to http://localhost:5173
</details>

### ⚡ One-Line Install (Linux/macOS only)

```bash
git clone https://github.com/yourusername/aira.git && cd aira && ./install.sh
```

This will:
1. ✅ Check all prerequisites
2. 📥 Download all AI models (~3GB)
3. 🔨 Build the Rust backend
4. 📦 Install frontend dependencies
5. 🎉 Set up everything for you!

### 🚀 Run Aira

**Linux/macOS:**
```bash
# Option 1: Web UI (Recommended)
./aira-serve

# Option 2: CLI Version
cd aira && cargo run --release
```

**Windows:**
```powershell
# Option 1: Web UI (Recommended)
.\aira-serve.bat

# Option 2: CLI Version
cd aira
.\target\release\aira_server.exe
```

Then open your browser to **http://localhost:5173**

**Note:** First startup will take a few minutes as models are loaded into memory.

### 📋 Manual Setup (Alternative)

If you prefer manual setup:

```bash
# 1. Clone
git clone https://github.com/yourusername/aira.git
cd aira

# 2. Download models (see install.sh for URLs)
mkdir -p aira/models aira/tts_models
# Download: Whisper, Qwen2.5, Piper TTS

# 3. Build
cd aira
cargo build --release
cd frontend && npm install && npm run build

# 4. Run
./target/release/aira_server  # Terminal 1
cd frontend && npm run dev    # Terminal 2
```

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

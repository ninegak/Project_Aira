#!/bin/bash

# Aira Installation Script
# This script downloads all required models and builds Aira
# Note: This script is for Linux/macOS. Windows users should follow the manual instructions in README.md

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$BASE_DIR/aira/models"
TTS_DIR="$BASE_DIR/aira/tts_models"

echo -e "${BLUE}🌸 Aira Installation Script${NC}"
echo "================================"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Rust
if ! command -v rustc &> /dev/null; then
    echo -e "${RED}❌ Rust not found. Please install Rust first:${NC}"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi
echo -e "${GREEN}✓ Rust found${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+:${NC}"
    echo "   https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found${NC}"

# Check FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${YELLOW}⚠️  FFmpeg not found. Installing...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y ffmpeg
    elif command -v yum &> /dev/null; then
        sudo yum install -y ffmpeg
    elif command -v brew &> /dev/null; then
        brew install ffmpeg
    else
        echo -e "${RED}❌ Could not install FFmpeg automatically. Please install it manually.${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ FFmpeg found${NC}"

echo ""
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p "$MODELS_DIR"
mkdir -p "$TTS_DIR"
echo -e "${GREEN}✓ Directories created${NC}"

# Function to download with progress
download_model() {
    local url=$1
    local output=$2
    local name=$3
    
    if [ -f "$output" ]; then
        echo -e "${GREEN}✓ $name already exists, skipping${NC}"
        return
    fi
    
    echo -e "${YELLOW}📥 Downloading $name...${NC}"
    wget --progress=bar:force "$url" -O "$output" 2>&1 | tail -f -n +6
    echo -e "${GREEN}✓ $name downloaded${NC}"
}

echo ""
echo -e "${BLUE}📦 Downloading AI Models${NC}"
echo "=========================="
echo ""

# Download Whisper model
download_model \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin" \
    "$MODELS_DIR/ggml-small.en-q5_1.bin" \
    "Whisper STT Model"

# Download LLM model (Qwen2.5 3B)
download_model \
    "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_0.gguf" \
    "$MODELS_DIR/qwen2.5-3b-instruct-q4_0.gguf" \
    "Qwen2.5 LLM Model"

# Download Piper TTS model
download_model \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx" \
    "$TTS_DIR/en_US-hfc_female-medium.onnx" \
    "Piper TTS Model"

# Download Piper TTS config
download_model \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json" \
    "$TTS_DIR/en_US-hfc_female-medium.onnx.json" \
    "Piper TTS Config"

echo ""
echo -e "${BLUE}🔨 Building Backend${NC}"
echo "===================="
echo ""

cd "$BASE_DIR/aira"
echo -e "${YELLOW}Building Rust backend (this may take a few minutes)...${NC}"
cargo build --release 2>&1 | while read line; do
    echo "   $line"
done
echo -e "${GREEN}✓ Backend built successfully${NC}"

echo ""
echo -e "${BLUE}📦 Building Frontend${NC}"
echo "===================="
echo ""

cd "$BASE_DIR/aira/frontend"
echo -e "${YELLOW}Installing npm dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "${YELLOW}Building frontend...${NC}"
npm run build
echo -e "${GREEN}✓ Frontend built successfully${NC}"

echo ""
echo -e "${BLUE}🎉 Installation Complete!${NC}"
echo "=========================="
echo ""
echo -e "${GREEN}Aira has been successfully installed!${NC}"
echo ""
echo "To start Aira:"
echo ""
echo "  ${YELLOW}# Option 1: Run with web UI${NC}"
echo "  ${GREEN}./aira-serve${NC}"
echo ""
echo "  ${YELLOW}# Option 2: Run CLI version${NC}"
echo "  ${GREEN}cd aira && cargo run --release${NC}"
echo ""
echo "The web UI will be available at: ${BLUE}http://localhost:5173${NC}"
echo "The API server will run on: ${BLUE}http://127.0.0.1:3000${NC}"
echo ""
echo -e "${YELLOW}Note: First startup may take a few minutes as models are loaded into memory.${NC}"

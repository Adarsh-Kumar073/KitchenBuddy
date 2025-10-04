# 🎙️ AI Voice Cooking Assistant

An AI-powered cooking assistant built with **Next.js, FastAPI/Node.js APIs, MongoDB, WebSockets, and LLMs (Gemini/OpenAI)**.  
The app allows users to **sign up, log in, chat with an AI cooking specialist, and even use voice input/output**.

---

## 🚀 Features

- 🔐 **Authentication**  
  - JWT-based signup/login system  
  - MongoDB for user storage  

- 💬 **Conversations**  
  - Start a new chat or continue previous ones  
  - Conversations stored in MongoDB  
  - Secure APIs protected by token  

- 🤖 **AI Integration**  
  - Primary: Google Gemini (1.5 Flash / 2.0)  
  - Fallback: OpenAI GPT-3.5/GPT-4o-mini  
  - Provides step-by-step cooking instructions with timeline  

- 🎤 **Voice Support**  
  - Real-time WebSocket connection (`ws://localhost:8000/ws`)  
  - Microphone input → transcribed → AI response → audio playback  
  - Silence detection for smart flushing  

- 📱 **Frontend (Next.js)**  
  - Modern, responsive UI (TailwindCSS)  
  - Sidebar with conversations list + delete option  
  - Loader shown while AI is generating a response  

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 13 (App Router), TailwindCSS  
- **Backend APIs**: Next.js API routes  
- **Database**: MongoDB Atlas (Mongoose ODM)  
- **Authentication**: JWT + bcrypt  
- **AI Models**:  
  - Google Generative AI (Gemini 1.5/2.0)  
  - OpenAI GPT (as fallback)  
- **Realtime Audio**: WebSockets (`ws://localhost:8000/ws`) + MediaRecorder API  

---

## Install dependencies
npm install

## Configure Environment Variables

Create a .env.local file:

-MONGODB_URI=your_mongodb_atlas_connection_string
-JWT_SECRET=your_secret_key
-GOOGLE_API_KEY=your_gemini_api_key
-OPENAI_API_KEY=your_openai_api_key   # optional fallback

## Run the development server
npm run dev


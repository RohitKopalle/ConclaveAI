# 🧠 AI Conclave

**AI Conclave** is a multi-agent intelligence engine that solves complex problems through structured AI deliberation.  
Instead of relying on a single model response, it orchestrates multiple specialized AI agents that debate, critique, and refine ideas to produce high-quality, reliable outputs.

---

## 🚀 Overview

AI Conclave introduces the concept of **"Diversity of Thought"** in AI systems by assigning different roles to different models.

Given a complex query, the system runs a **multi-stage reasoning pipeline**:

> Proposal → Critique → Refinement → Verification → Final Synthesis

This results in more accurate, grounded, and well-reasoned outputs compared to traditional single-model systems.

---

## 🧠 Multi-Agent Architecture

### 🔹 Agent Alpha (Mistral-Nemo)
- Generates the **initial proposal (V1)**
- Establishes baseline reasoning and structure

### 🔹 Agent Beta (Qwen2.5-7B)
- Acts as a **critic and strategist**
- Performs fact-checking, identifies flaws, and suggests improvements

### 🔹 Chairman AI
- Final **decision-maker and synthesizer**
- Verifies logic and produces the **Executive Output**

---

## 🔁 Deliberation Pipeline

1. User submits a complex query  
2. Agent Alpha generates initial response (V1)  
3. Agent Beta critiques and refines the response  
4. Improved version (V2) is created  
5. Chairman AI verifies and synthesizes final output  

---

## 🌐 Real-Time Intelligence

AI Conclave integrates with **Bright Data SERP API** to fetch live web data.

This ensures:
- 📡 Up-to-date information  
- ❌ Reduced hallucination  
- ✅ Fact-grounded reasoning  

---

## 📊 Evolution Log (Key Feature)

Every step of the agent interaction is tracked and displayed as an **"Evolution Log"**, allowing users to:

- Observe how ideas evolve  
- Understand reasoning improvements  
- Gain transparency into AI decision-making  

---

## 🛠️ Tech Stack

### ⚛️ Frontend
- Next.js (TypeScript)
- Tailwind CSS
- Framer Motion (for animations & UI polish)

### 🔧 Backend / Orchestration
- Next.js Route Handlers
- Featherless AI (for model orchestration)

### 🤖 AI Models
- Mistral-Nemo (Agent Alpha)
- Qwen2.5-7B (Agent Beta)
- Custom orchestration for Chairman AI

### 🗄️ Database
- Supabase (PostgreSQL)
- Stores session history & deliberation logs

### 🌐 Data Layer
- Bright Data SERP API (real-time grounding)

---

## ✨ Key Features

- 🧠 Multi-agent reasoning system  
- 🔄 Iterative refinement pipeline  
- 🌐 Real-time web grounding  
- 📊 Transparent evolution tracking  
- 🎯 Role-based LLM orchestration  
- 💾 Persistent session memory  

---

## ⚠️ Disclaimer

The UI is still evolving and not fully polished.  
However, the **core system and agent orchestration pipeline are fully functional**.

---

## 🚀 Future Improvements

- Enhanced UI/UX design  
- More agent roles (e.g., Domain Experts)  
- Better evaluation metrics for responses  
- Support for more models and dynamic routing  
- Performance optimizations  

---

## 💡 Inspiration

AI Conclave is built on the idea that:

> "Better decisions come from multiple perspectives — not a single voice."

---

## 👨‍💻 Author

Developed primarily by **Kopalle Rohit** during the Forge Aluminus Codeathon.

Team members: Teja, Santosh, Raj Vardhan.


# ⚡ TaskGenius V2 (AI Powered)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB.svg)
![Node](https://img.shields.io/badge/backend-Node.js%20%2B%20Express-339933.svg)
![AI](https://img.shields.io/badge/AI-OpenRouter%20%2F%20Multi--Model-FF6F61.svg)

> **Autonomous Edition:** The intelligent project management tool that thinks for you.

TaskGenius V2 is not just a to-do list; it's a strategic partner. Powered by an advanced multi-model AI system via **OpenRouter**, it autonomously breaks down complex goals, prioritizes your day based on urgency, and adapts to API constraints in real-time.

---

## 🚀 Key Features

### 🧠 Advanced AI Model Fallback (OpenRouter)
TaskGenius is built for resilience. It employs a **dynamic fallback chain** using OpenRouter's free-tier powerhouse models. If one model hits a rate limit or is overloaded, the system automatically cycles through:
1.  **google/gemma-3-4b-it:free** (Fastest Responder)
2.  **meta-llama/llama-3.2-3b-instruct:free** (Reliable Backup)
3.  **mistralai/mistral-small-3.1-24b-instruct:free** (Smart Mid-Tier)
4.  **google/gemma-3-12b-it:free** (High-Performance Alternative)
5.  **meta-llama/llama-3.3-70b-instruct:free** (The Powerhouse)
6.  **microsoft/phi-3-medium-128k-instruct:free** (Final Fallback)

### ✨ Magic-to-Manual Resilience
We believe in "Graceful Degradation." 
-   **Magic Mode:** Simply type "Draft Q4 report" and the AI infers the priority, due date, and generates 3 strategic sub-tasks instantly.
-   **Fail-Safe:** In the event that all AI models are exhausted (API Quotas), the system intelligently notifies you to switch to **Manual Mode**, ensuring you can *always* capture your tasks.

### 🔥 Dynamic Urgency Scoring
Stop guessing what to do next. Our proprietary **Urgency Algorithm** dynamically scores every task from 1-10 based on:
-   **Temporal Proximity:** Overdue tasks naturally bubble to the top.
-   **Weighted Priority:** "Critical Hit" items get a mathematical boost over "Standard" tasks.
-   **Context:** Tasks due "Today" are algorithmically distinguished from those due "Tomorrow."

---

## 🛠️ Tech Stack

**Frontend**
-   **Framework:** React 18 (Vite)
-   **Styling:** Vanilla CSS (Glassmorphism & Modern UI)
-   **Icons:** Heroicons
-   **State:** React Hooks with optimized keyboard accessibility

**Backend**
-   **Runtime:** Node.js + Express.js
-   **Database:** MongoDB directly
-   **AI Engine:** OpenAI-compatible SDK (OpenRouter)

---

## ☁️ Deployment (AWS App Runner)

TaskGenius V2 is configured for **Single-Service Deployment** on AWS App Runner using the included `apprunner.yaml` and root `package.json`.

### Build & Run Pipeline:
The root configuration automatically:
1. Installs dependencies for both Frontend and Backend.
2. Compiles the React application (`npm run build`).
3. Serves the static assets directly through the Express backend for maximum efficiency.

---

## 🔑 Environment Variables

Set the following secrets in your AWS App Runner configuration or local `.env`:

```env
# Server Configuration
PORT=5000

# Database Connection
MONGODB_URI=your_mongodb_connection_string

# AI Intelligence
OPENROUTER_API_KEY=your_openrouter_key_here
```

---

## 🤝 Contributing
Contributions are welcome! Please fork the repository and submit a pull request for any enhancements or bug fixes.

---

**TaskGenius V2** — *Built for the autonomous future.*


# ⚡ TaskGenius V2 (AI Powered)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB.svg)
![Node](https://img.shields.io/badge/backend-Node.js%20%2B%20Express-339933.svg)
![AI](https://img.shields.io/badge/AI-Gemini%203.0%20%2F%201.5-8E75B2.svg)

> **Autonomous Edition:** The intelligent project management tool that thinks for you.

TaskGenius V2 is not just a to-do list; it's a strategic partner. Powered by an advanced multi-model AI system, it autonomously breaks down complex goals, prioritizes your day based on urgency, and adapts to API constraints in real-time.

---

## 🚀 Key Features

### 🧠 Advanced AI Model Fallback
TaskGenius is built for resilience. It employs a **smart routing system** that attempts to use the most capable models first, ensuring maximum uptime and intelligence:
1.  **Primary:** `gemini-3-flash-preview` (Next-Gen Intelligence)
2.  **Secondary:** `gemini-1.5-flash` (High Speed)
3.  **Tertiary:** `gemini-2.0-flash` (Reliable Backup)

If one model encounters a rate limit or service error, the system **automatically re-routes** the request to the next available model without interrupting your workflow.

### ✨ Magic-to-Manual Resilience
We believe in "Graceful Degradation." 
-   **Magic Mode:** Simply type "Draft Q4 report" and the AI infers the priority (High), due date (End of Quarter), and generates 5 sub-tasks instantly.
-   **Fail-Safe:** In the rare event that all AI models are exhausted (API Quotas), the system intelligently notifies you to switch to **Manual Mode**, ensuring you can *always* capture your tasks, regardless of external service status.

### 🔥 Dynamic Urgency Scoring
Stop guessing what to do next. Our proprietary **Urgency Algorithm** dynamically scores every task from 1-10 based on:
-   **Temporal Proximity:** Overdue tasks naturally bubble to the top.
-   **Weighted Priority:** "Critical Hit" items get a mathematical boost over "Standard" tasks.
-   **Context:** Tasks due "Today" are algorithmically distinguished from those due "Tomorrow."

*The result? A heat-map style visual indicator that tells you exactly where to focus your energy.*

### 🔒 Anti-Spam Strategy Lock
To preserve API integrity and encourage thoughtful planning, the "Analyze Today" feature includes a **15-second Cooldown Lock**. This prevents accidental double-submissions and ensures the AI has time to generate a high-quality, non-hallucinated strategy for your day.

---

## 🛠️ Tech Stack

**Frontend**
-   **Framework:** React 18 (Vite)
-   **Styling:** Tailwind CSS (Glassmorphism & Modern UI)
-   **Icons:** Heroicons (Outline & Solid)
-   **State:** React Hooks (with Optimistic UI updates)

**Backend**
-   **Runtime:** Node.js
-   **Framework:** Express.js
-   **Database:** MongoDB directly (via Mongoose schemas)
-   **AI Engine:** Google Generative AI SDK (`@google/generative-ai`)

---

## 🔑 Environment Variables

Create a `.env` file in the `backend/` directory with the following secrets:

```env
# Server Configuration
PORT=5000

# Database Connection
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/taskgenius

# AI Intelligence
GEMINI_API_KEY=your_google_gemini_api_key_here
```

---

## 📦 Setup Instructions

### Prerequisites
-   Node.js (v16+)
-   MongoDB Instance (Local or Atlas)
-   Google Cloud API Key (Gemini)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/TaskGenius.git
cd TaskGenius
```

### 2. Backend Setup
```bash
cd backend
npm install
# Create your .env file here (see above)
node index.js
```
*Server will start on `http://localhost:5000`*

### 3. Frontend Setup
```bash
# Open a new terminal
cd frontend
npm install
npm run dev
```
*App will launch on `http://localhost:5173`*

---

## 🤝 Contributing
Contributions are welcome! Please fork the repository and submit a pull request for any enhancements or bug fixes.

---

**TaskGenius V2** — *Built for the autonomous future.*

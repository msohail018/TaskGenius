require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Task = require('./models/Task');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security: Body size limit (prevents large payload attacks) ──
app.use(express.json({ limit: '10kb' }));

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

// ── Security: Rate Limiting ──
// General API limiter: 100 req/15min per IP
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' }
});

// Stricter limiter for AI endpoints: 20 req/15min per IP
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'AI rate limit reached. Please wait before making more AI requests.' }
});

app.use('/api', generalLimiter);

const { GoogleGenerativeAI } = require("@google/generative-ai");

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, p) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// Connect to MongoDB
let mongoURI = process.env.MONGODB_URI;
if (!mongoURI || !mongoURI.startsWith('mongodb')) {
    console.warn("⚠️ Invalid MONGODB_URI detected. Falling back to local default.");
    mongoURI = "mongodb://127.0.0.1:27017/taskgen";
}
console.log("Connecting to MongoDB..."); // URI hidden for security
mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => {
      console.error('MongoDB Connection Error:', err.message);
  });

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─────────────────────────────────────────
// Helper: Clean AI text to extract raw JSON
// ─────────────────────────────────────────
function cleanJson(text) {
    if (!text) return "";
    // Strip markdown code fences
    let cleaned = text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
    // Extract the first valid JSON object {...} or array [...]
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) return match[0].trim();
    return cleaned;
}

// ─────────────────────────────────────────
// Multi-Model Fallback Helper
// Sequence: gemini-2.5-flash → gemini-3.0-flash → gemini-1.5-flash
// ─────────────────────────────────────────
async function generateWithFallback(prompt, outputJson = false) {
    const models = ["gemini-2.5-flash", "gemini-3.0-flash", "gemini-1.5-flash", "gemini-2.0-flash-lite"];

    for (const modelName of models) {
        try {
            console.log(`🤖 Trying Model: ${modelName}...`);
            const generationConfig = { maxOutputTokens: 500 };
            if (outputJson) {
                generationConfig.responseMimeType = "application/json";
            }
            const model = genAI.getGenerativeModel({ model: modelName, generationConfig });
            const result = await model.generateContent(prompt);
            const text = result.response.text();

            if (!text) throw new Error("Empty response from AI");

            console.log(`✅ Success with ${modelName}`);
            return { text, modelUsed: modelName };

        } catch (error) {
            let status = "Unknown";
            if (error.status) status = error.status;
            else if (error.response?.status) status = error.response.status;
            else if (error.message.includes('429')) status = "429 (Quota)";
            else if (error.message.includes('503')) status = "503 (Overloaded)";
            else if (error.message.includes('404')) status = "404 (Model Not Found)";

            console.error(`❌ Model [${modelName}] Failed | Status: ${status} | Error: ${error.message}`);

            if (String(status).includes('429')) {
                console.warn(`🛑 QUOTA HIT on ${modelName}. Waiting 3s...`);
                await new Promise(r => setTimeout(r, 3000));
            } else {
                await new Promise(r => setTimeout(r, 1000));
            }

            if (modelName === models[models.length - 1]) {
                console.error("❌ All AI models exhausted.");
                throw new Error("All AI models exhausted. Please try again later.");
            }
        }
    }
}

// ─────────────────────────────────────────
// Utility: Calculate Urgency Score
// ─────────────────────────────────────────
const calculateUrgency = (task) => {
    let score = 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let priorityVal = 0;
    if (task.priority === 'Critical Hit' || task.priority === 'High') priorityVal = 2;
    else if (task.priority === 'Medium') priorityVal = 1;

    if (task.dueDate) {
        const due = new Date(task.dueDate);
        const offset = due.getTimezoneOffset() * 60000;
        const dueLocal = new Date(due.getTime() + offset);
        const dueDay = new Date(dueLocal.getFullYear(), dueLocal.getMonth(), dueLocal.getDate());

        if (dueDay < today) {
            score = 10;
        } else if (dueDay.getTime() === today.getTime()) {
            score = 8 + priorityVal;
        } else {
            const diffDays = Math.ceil((dueDay - today) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) score = 5 + priorityVal;
            else if (diffDays <= 3) score = 4 + priorityVal;
            else if (diffDays <= 7) score = 3;
            else score = 1;
        }
    } else {
        score = 1;
    }

    return Math.min(score, 10);
};

// ─────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────

// GET all tasks (sorted by urgency)
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.find().lean();
        const tasksWithScore = tasks.map(t => ({ ...t, urgencyScore: calculateUrgency(t) }));
        const priorityWeight = { 'Critical Hit': 4, 'High': 3, 'Medium': 2, 'Low': 1, 'Backburner': 0 };
        tasksWithScore.sort((a, b) => {
            if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
            return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        });
        res.json(tasksWithScore);
    } catch (error) {
        console.error("Fetch tasks error:", error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create new task (Magic Mode or Manual Mode)
app.post('/api/tasks', async (req, res) => {
    const { mode, text, ...manualData } = req.body;

    try {
        // ── MANUAL MODE ──
        if (mode === 'manual') {
            if (!manualData.title || !manualData.title.trim()) {
                return res.status(400).json({ error: "Task title is required." });
            }
            // Enforce title length limit
            if (manualData.title.trim().length > 200) {
                return res.status(400).json({ error: "Task title must be under 200 characters." });
            }
            const newTask = new Task({
                title: manualData.title.trim().substring(0, 200),
                description: manualData.description?.substring(0, 1000) || '',
                priority: manualData.priority || 'Medium',
                dueDate: manualData.dueDate,
                energyLevel: 'Admin',
                category: 'Upcoming',
                status: 'todo',
                subTasks: []
            });
            await newTask.save();
            const taskObj = newTask.toObject();
            taskObj.urgencyScore = calculateUrgency(taskObj);
            return res.status(201).json(taskObj);
        }

        // ── MAGIC MODE (apply stricter AI rate limit) ──
        if (!text || !text.trim()) {
            return res.status(400).json({ error: "Magic text prompt is required." });
        }
        // Security: cap magic text to prevent prompt injection / large payloads
        if (text.trim().length > 500) {
            return res.status(400).json({ error: "Magic text is too long. Keep it under 500 characters." });
        }
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "No GEMINI_API_KEY configured on server." });
        }

        try {
            const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

            const prompt = `
Today's date is ${today}.
User input: "${text}"

Rules:
- "tonight" or "today" → dueDate = ${today}
- "tomorrow" → dueDate = next day
- No date mentioned → infer a realistic future date

Return ONLY this JSON object. No markdown. No backticks. No extra text:
{
  "title": "short task title",
  "description": "brief details",
  "priority": "High",
  "energyLevel": "Admin",
  "dueDate": "${today}",
  "subTasks": ["step 1", "step 2", "step 3"]
}
            `.trim();

            console.log("🤖 Magic Mode task from:", text);
            const { text: aiText, modelUsed } = await generateWithFallback(prompt, false);

            let analysis;
            try {
                const jsonStr = cleanJson(aiText);
                analysis = JSON.parse(jsonStr);
                console.log(`✅ Magic Mode parsed (${modelUsed}):`, JSON.stringify(analysis, null, 2));
            } catch (e) {
                console.error("❌ Magic Parse Failed. Raw AI response:\n", aiText);
                return res.status(500).json({ error: "AI returned unparseable response. Try again." });
            }

            const dueDate = analysis.dueDate ? new Date(analysis.dueDate) : null;

            const newTask = new Task({
                title: analysis.title,
                description: analysis.description,
                priority: analysis.priority || 'Medium',
                energyLevel: analysis.energyLevel || 'Admin',
                category: 'Upcoming',
                dueDate,
                status: 'todo',
                subTasks: Array.isArray(analysis.subTasks) ? analysis.subTasks : []
            });

            await newTask.save();
            const taskObj = newTask.toObject();
            taskObj.urgencyScore = calculateUrgency(taskObj);
            taskObj.modelUsed = modelUsed;
            return res.status(201).json(taskObj);

        } catch (aiError) {
            console.error("❌ Gemini Magic Error:", aiError.message);
            return res.status(500).json({ error: `AI Failed: ${aiError.message}` });
        }

    } catch (error) {
        console.error('FULL ERROR:', error);
        if (error.name === 'ValidationError') return res.status(400).json({ error: error.message });
        res.status(500).json({ error: 'Server error creating task' });
    }
});

// PUT update task
app.put('/api/tasks/:id', async (req, res) => {
    try {
        // Security: validate ObjectId format to prevent injection / CastError crashes
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid task ID format.' });
        }
        // Security: whitelist-only update — prevent mass-assignment / field injection
        const allowedFields = ['title', 'description', 'status', 'priority', 'dueDate', 'energyLevel', 'subTasks', 'category'];
        const updateData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }
        const updatedTask = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).lean();
        if (!updatedTask) return res.status(404).json({ error: 'Task not found.' });
        updatedTask.urgencyScore = calculateUrgency(updatedTask);
        res.json(updatedTask);
    } catch (error) {
        console.error("Update task error:", error);
        res.status(500).json({ error: 'Server error updating task' });
    }
});

// DELETE task
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        // Security: validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid task ID format.' });
        }
        const deleted = await Task.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Task not found.' });
        res.json({ message: 'Task deleted' });
    } catch (error) {
        console.error("Delete task error:", error);
        res.status(500).json({ error: 'Server error deleting task' });
    }
});

// POST generate subtasks (Breakdown) — apply AI rate limiter
app.post('/api/tasks/:id/breakdown', aiLimiter, async (req, res) => {
    try {
        // Security: validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid task ID format.' });
        }
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (!task.title) return res.status(400).json({ error: 'Task title is missing.' });

        const daysUntilDue = task.dueDate
            ? Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
            : null;

        const urgencyNote = (daysUntilDue !== null && daysUntilDue < 3 && daysUntilDue >= 0)
            ? "URGENT: first steps must be immediate actions for today."
            : "Standard timeline.";

        const prompt = `
Break down this task into steps: "${task.title}"
Context: ${urgencyNote}

Return ONLY a JSON array of exactly 3 short strings. No markdown. No backticks. No extra text.
Example: ["Step one description", "Step two description", "Step three description"]
        `.trim();

        try {
            console.log(`🤖 Generating breakdown for: ${task.title}`);
            const { text: aiText, modelUsed } = await generateWithFallback(prompt, false);

            console.log("📦 Raw AI breakdown response:\n", aiText);

            let subTasks = [];
            try {
                const cleaned = cleanJson(aiText);
                const parsed = JSON.parse(cleaned);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    subTasks = parsed.filter(s => typeof s === 'string' && s.trim().length > 0);
                }
            } catch (e) {
                console.warn("⚠️ JSON parse failed on breakdown, trying line split...");
                // Strip all brackets/quotes and split by newlines
                subTasks = aiText
                    .replace(/[\[\]"]/g, '')
                    .split(/[\n,]+/)
                    .map(l => l.replace(/^[\d.*•\-]+\s*/, '').trim())
                    .filter(l => l.length > 3);
            }

            if (!subTasks || subTasks.length === 0) {
                console.error("❌ Could not extract steps from AI response:\n", aiText);
                return res.status(500).json({ error: "AI returned invalid breakdown structure. Try again." });
            }

            task.subTasks = subTasks.slice(0, 3);
            await task.save();

            const taskObj = task.toObject();
            taskObj.urgencyScore = calculateUrgency(taskObj);
            taskObj.modelUsed = modelUsed;

            console.log(`✅ Breakdown saved via ${modelUsed}:`, task.subTasks);
            res.json(taskObj);

        } catch (aiError) {
            console.error("❌ Gemini Breakdown Error:", aiError.message);
            return res.status(500).json({ error: `AI Breakdown Failed: ${aiError.message}` });
        }

    } catch (error) {
        console.error("Server Error (Breakdown Route):", error);
        res.status(500).json({ error: 'Internal Server Error during Breakdown' });
    }
});

// GET tasks grouped by date
app.get('/api/tasks/by-date', async (req, res) => {
    try {
        const tasks = await Task.find({ status: { $ne: 'done' } }).lean();

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const nextWeekRaw = new Date(now);
        nextWeekRaw.setDate(now.getDate() + 7);
        const nextWeek = new Date(nextWeekRaw.setHours(23, 59, 59, 999));

        const grouped = { overdue: [], today: [], upcoming: [], future: [] };

        tasks.forEach(t => {
            t.urgencyScore = calculateUrgency(t);
            if (!t.dueDate) { grouped.future.push(t); return; }
            const date = new Date(t.dueDate);
            if (date < startOfToday) grouped.overdue.push(t);
            else if (date >= startOfToday && date <= endOfToday) grouped.today.push(t);
            else if (date > endOfToday && date <= nextWeek) grouped.upcoming.push(t);
            else grouped.future.push(t);
        });

        const sorter = (a, b) => b.urgencyScore - a.urgencyScore;
        grouped.overdue.sort(sorter);
        grouped.today.sort(sorter);
        grouped.upcoming.sort(sorter);
        grouped.future.sort(sorter);

        res.json(grouped);
    } catch (error) {
        console.error("Sorting error:", error);
        res.status(500).json({ error: "Sorting failed" });
    }
});

// GET daily plan (AI summary)
app.get('/api/daily-plan', async (req, res) => {
    try {
        const tasks = await Task.find({ status: { $ne: 'done' } }).sort({ urgencyScore: -1 });
        if (tasks.length === 0) {
            return res.json({ message: "No tasks pending. You have a clean slate for the day!" });
        }

        let message = "Loading your daily intelligence...";
        let modelUsed = null;

        try {
            const taskDigest = tasks.slice(0, 10).map(t => `- [${t.priority}] ${t.title}`).join('\n');
            const remaining = tasks.length > 10 ? `...and ${tasks.length - 10} more.` : '';

            const userPrompt = `
You are an elite productivity assistant.
My tasks for today:
${taskDigest}
${remaining}

Write a 1-2 sentence morning briefing. Be concise and motivating.
            `.trim();

            const result = await generateWithFallback(userPrompt, false);
            message = result.text;
            modelUsed = result.modelUsed;
            console.log("✅ Daily Plan AI Success. Model:", modelUsed);
        } catch (aiError) {
            console.error("❌ Gemini Error (Daily Plan):", aiError.message);
            const highPri = tasks.filter(t => t.priority === 'High' || t.priority === 'Critical Hit').length;
            message = `You have ${tasks.length} tasks today` + (highPri > 0 ? `, including ${highPri} high-priority items.` : '.');
        }

        res.json({ message, modelUsed });
    } catch (error) {
        console.error("Error generating daily plan:", error);
        res.json({ message: "Ready to conquer your tasks?" });
    }
});

// POST analyze today's tasks
app.post('/api/analyze-today', async (req, res) => {
    try {
        const { tasks } = req.body;
        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
            return res.json({ message: "You're all clear for today! Enjoy your freedom." });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const taskList = tasks.map(t => {
            const due = t.dueDate ? new Date(t.dueDate) : null;
            const isOverdue = due && due < today;
            let label;
            if (isOverdue) {
                const daysPast = Math.max(1, Math.floor((today - due) / (1000 * 60 * 60 * 24)));
                label = `🔴 OVERDUE (${daysPast} day${daysPast > 1 ? 's' : ''} LATE — MUST DO IMMEDIATELY)`;
            } else {
                label = '📅 DUE TODAY';
            }
            return `- [${label}] [Priority: ${t.priority}] ${t.title}`;
        }).join('\n');

        const overdueCount = tasks.filter(t => {
            const due = t.dueDate ? new Date(t.dueDate) : null;
            return due && due < today;
        }).length;

        const prompt = `
You are a no-nonsense productivity coach. Today's date is ${today.toDateString()}.

CRITICAL RULES — you MUST follow these:
- Any task labeled 🔴 OVERDUE is ALREADY LATE. It is NOT distant. It is NOT upcoming. It is PAST DUE.
- Do NOT use words like "distant", "upcoming", "future", or "later" for overdue tasks.
- Overdue tasks are the HIGHEST PRIORITY regardless of their priority label.

My ${tasks.length} active tasks right now (${overdueCount} are already overdue):
${taskList}

Write exactly 2 short, sharp sentences:
1. State the urgency clearly — name the overdue tasks as LATE and requiring IMMEDIATE action.
2. Tell me exactly which task to start on RIGHT NOW.
        `.trim();

        try {
            const { text: strategy, modelUsed: aiModel } = await generateWithFallback(prompt, false);
            console.log("✅ Analyze Today AI Success. Model:", aiModel);
            res.json({ message: strategy, modelUsed: aiModel });
        } catch (aiError) {
            console.error("❌ Gemini Error (Analyze Today):", aiError.message);
            if (aiError.message.includes('exhausted')) {
                return res.status(429).json({ error: "AI quota hit. Try again in a minute." });
            }
            const critical = tasks.find(t => t.priority === 'Critical Hit');
            const high = tasks.find(t => t.priority === 'High');
            const startTask = critical || high || tasks[0];
            res.json({ message: `Start with "${startTask.title}" for maximum impact across your ${tasks.length} tasks.` });
        }

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ error: "Failed to analyze tasks." });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

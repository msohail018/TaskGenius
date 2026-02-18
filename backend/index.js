require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Task = require('./models/Task');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

const { GoogleGenerativeAI } = require("@google/generative-ai");

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, p) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// Connect to MongoDB
// Connect to MongoDB
let mongoURI = process.env.MONGODB_URI;
if (!mongoURI || !mongoURI.startsWith('mongodb')) {
    console.warn("⚠️ Invalid MONGODB_URI detected. Falling back to local default.");
    mongoURI = "mongodb://127.0.0.1:27017/taskgen"; 
}
console.log("Connecting to MongoDB at", mongoURI);
mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => {
      console.error('MongoDB Connection Error:', err.message);
  });

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Multi-Model Fallback Helper
async function generateWithFallback(prompt, outputJson = false) {
    // The "Triple-Threat" Fallback Array (Cutting Edge -> Speed -> Stability)
    const models = ["gemini-1.5-flash"]; 

    for (const modelName of models) {
        try {
            console.log(`🤖 Testing Model: ${modelName}...`);
            const modelConfig = { model: modelName };
            if (outputJson) {
                modelConfig.generationConfig = { responseMimeType: "application/json" };
            }

            const model = genAI.getGenerativeModel(modelConfig);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            if (!text) throw new Error("Empty response from AI");

            console.log(`✅ Success with ${modelName}`);
            return { text, modelUsed: modelName };
        } catch (error) {
            let status = "Unknown";
            if (error.status) status = error.status;
            else if (error.response?.status) status = error.response.status;
            else if (error.message.includes('429')) status = "429 (Quota)";
            else if (error.message.includes('503')) status = "503 (Overloaded)";
            
            console.warn(`⚠️ Model ${modelName} Failed | Status: ${status} | Reason: ${error.message}`);
            
            if (String(status).includes('429')) {
                console.error(`🛑 QUOTA HIT for ${modelName}. Waiting longer...`);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s instead of 1s
            }
            
            // If it was the last model, throw the error to trigger offline mode
            if (modelName === models[models.length - 1]) {
                 console.error("❌ All AI models exhausted.");
                 throw new Error("All AI models exhausted. Switching to Manual/Offline Mode.");
            }
            
            // Wait 1s before retrying next model to be polite
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Routes

// Utility: Calculate Urgency Score (Centralized Algorithm)
const calculateUrgency = (task) => {
    let score = 0;
    // Normalized "Local" Today (strip time)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Priority Values (Used for addition)
    let priorityVal = 0;
    if (task.priority === 'Critical Hit' || task.priority === 'High') priorityVal = 2;
    else if (task.priority === 'Medium') priorityVal = 1;

    if (task.dueDate) {
        // Parse due date strictly as YYYY-MM-DD local
        const due = new Date(task.dueDate);
        // Correct for timezone offset to treat YYYY-MM-DD as local midnight
        const userTimezoneOffset = due.getTimezoneOffset() * 60000;
        const dueLocal = new Date(due.getTime() + userTimezoneOffset);
        
        const dueDay = new Date(dueLocal.getFullYear(), dueLocal.getMonth(), dueLocal.getDate());
        
        if (dueDay < today) {
            score = 10; // Overdue = Max
        } else if (dueDay.getTime() === today.getTime()) {
            score = 8 + priorityVal; // Today = 8 + Priority
        } else {
            // Future logic
            const diffTime = dueDay - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) { // Tomorrow
                score = 5 + priorityVal; 
            } else if (diffDays <= 3) {
                score = 4 + priorityVal;
            } else if (diffDays <= 7) {
                score = 3;
            } else {
                score = 1;
            }
        }
    } else {
        score = 1; // Future/Undefined
    }

    return Math.min(score, 10); // Cap at 10
};

// Get all tasks (Sorted by Urgency)
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().lean();
    
    // Attach score
    const tasksWithScore = tasks.map(t => ({
        ...t,
        urgencyScore: calculateUrgency(t)
    }));

    // Sort: Urgency Descending (Primary), then Priority Weight (Secondary)
    const priorityWeight = { 'Critical Hit': 4, 'High': 3, 'Medium': 2, 'Low': 1, 'Backburner': 0 };
    
    tasksWithScore.sort((a, b) => {
        // 1. Primary Sort: Urgency Score (High to Low)
        if (b.urgencyScore !== a.urgencyScore) {
            return b.urgencyScore - a.urgencyScore;
        }
        // 2. Secondary Sort: Priority Weight (High > Med > Low)
        return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    });

    res.json(tasksWithScore);
  } catch (error) {
    console.error("Fetch tasks error:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new task (Dual Mode: Magic vs Manual)
app.post('/api/tasks', async (req, res) => {
  const { mode, text, ...manualData } = req.body;

  try {
    // 1. MANUAL MODE: Save directly
    if (mode === 'manual') {
        if (!manualData.title || !manualData.title.trim()) {
            return res.status(400).json({ error: "Task title is required." });
        }
        const newTask = new Task({
            title: manualData.title,
            description: manualData.description,
            priority: manualData.priority || 'Medium',
            dueDate: manualData.dueDate, // Expecting YYYY-MM-DD from frontend
            energyLevel: 'Admin', // Default
            category: 'Upcoming',
            status: 'todo',
            subTasks: []
        });
        await newTask.save();
        const taskObj = newTask.toObject();
        taskObj.urgencyScore = calculateUrgency(taskObj);
        return res.status(201).json(taskObj);
    }

    // 2. MAGIC MODE: AI Inference
    if (!text || !text.trim()) {
        return res.status(400).json({ error: "Magic text prompt is required." });
    }
    
    // Check API Key existence to prevent 500 from SDK
    if (!process.env.GEMINI_API_KEY) {
         console.warn("⚠️ No GEMINI_API_KEY found. Skipping AI.");
         // Trigger Fallback logic directly via Error
         throw new Error("Missing GEMINI_API_KEY"); 
    }

    try {
      // Inject Literal Local System Date
      const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (Local)
      
      const prompt = `
        Current Date is exactly: ${today}. You MUST respect this date.
        
        Analyze user input: "${text}". 
        
        Strict Rules:
        1. If input is "tonight", "today", "dinner", use this EXACT date: ${today}.
        2. "Tomorrow" = ${today} + 1 day.
        3. If no date is mentioned, infer a realistic one.
        4. "Get dinner" = High Priority.
        
        Return a strict JSON with:
        - title: (Catchy summary)
        - description: (Inferred details)
        - priority: (High/Medium/Low)
        - energyLevel: (Deep Work/Admin)
        - dueDate: (ISO Date String YYYY-MM-DD)
        - subTasks: (Array of 3-5 strings)
      `;

      // Use Fallback Generator
      console.log("🤖 Genering Magic Task from:", text);
      // Use FALSE for json mode to be deeper compatible with flash-1.5 
      const { text: aiResponseText, modelUsed } = await generateWithFallback(prompt, false);
      
      let analysis;
      try {
          const cleanText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
          analysis = JSON.parse(cleanText);
      } catch (e) {
          console.error("Magic Parsed Failed:", aiResponseText);
          throw new Error("AI returned invalid JSON format. Try Manual Mode.");
      }
      
      console.log(`Magic Mode Result (${modelUsed}):`, JSON.stringify(analysis, null, 2));

      // 3. Date Parsing - Handle AI's simplified date
      let dueDate = null;
      if (analysis.dueDate) {
          // AI returns YYYY-MM-DD. Treat as purely local date string.
          dueDate = new Date(analysis.dueDate); 
      }

      const newTask = new Task({
          title: analysis.title, 
          description: analysis.description,
          priority: analysis.priority,
          energyLevel: analysis.energyLevel,
          category: 'Upcoming',
          dueDate,
          status: 'todo',
          subTasks: analysis.subTasks
      });

      await newTask.save();
      const taskObj = newTask.toObject();
      taskObj.urgencyScore = calculateUrgency(taskObj);
      taskObj.modelUsed = modelUsed; // Pass back model info
      
      return res.status(201).json(taskObj);

    } catch (aiError) {
      console.error("Gemini Magic Error:", aiError.message);
      
      // FALLBACK: Create a basic task if AI fails
      console.log("⚠️ Magic AI failed. Creating raw task fallback.");
      
      const fallbackTask = new Task({
          title: text.length > 50 ? text.substring(0, 50) + "..." : text,
          description: `(AI Failed to parse) Original: ${text}`,
          priority: 'Medium',
          dueDate: new Date(), // Today
          status: 'todo',
          category: 'Inbox'
      });
      
      await fallbackTask.save();
      const taskObj = fallbackTask.toObject();
      taskObj.urgencyScore = calculateUrgency(taskObj);
      taskObj.modelUsed = "offline-fallback";
      
      // Return 201 Created (Success) even though AI failed
      return res.status(201).json(taskObj);
    }

  } catch (error) {
    console.error('FULL ERROR:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error creating task' });
  }
});

// Update task status or details
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if(updatedTask) updatedTask.urgencyScore = calculateUrgency(updatedTask);
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: 'Server error updating task' });
  }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting task' });
  }
});

// Generate Subtasks (AI Disaggregation) with Strict JSON Mode & Error Handling
app.post('/api/tasks/:id/breakdown', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!task.title) return res.status(400).json({ error: 'Task title is missing.' });
    
    // Deadline-aware prompt
    const daysUntilDue = task.dueDate 
        ? Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) 
        : 'unknown';

    const deadlineContext = daysUntilDue < 3 && daysUntilDue >= 0
        ? "URGENT DEADLINE: The first 2 steps must be immediate actions for TODAY. Prioritize speed."
        : "Standard timeline. Ensure steps are logical and sequential.";

    const prompt = `
      Act as a specialized consultant. Break down this task: "${task.title}"
      CONTEXT: ${deadlineContext}
      Limit: Generate max 3 concise bullet points.
      Return ONLY a JSON Array of strings.
      Example: ["Research requirements", "Draft outline", "Review", "Refine"]
    `;

    try {
        console.log(`🤖 Genering steps for: ${task.title}...`);
        // Use FALSE for json mode to be deeper compatible with flash-1.5 
        // We will manually clean the response if needed.
        const { text: aiResponseText, modelUsed } = await generateWithFallback(prompt, false);
        
        console.log("AI Response Raw:", aiResponseText);

        let subTasks = [];
        try {
            // Try cleaning markdown code blocks first
            const cleanText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
            subTasks = JSON.parse(cleanText);
        } catch (e) {
            console.warn("JSON Parse failed, attempting line split fallback...");
            // Fallback: Split by newlines and remove bullets
            subTasks = aiResponseText.split('\n')
                .map(line => line.replace(/^[\d-.*•]\s*/, '').trim())
                .filter(line => line.length > 3 && !line.startsWith('[') && !line.startsWith(']'));
        }

        if (!Array.isArray(subTasks) || subTasks.length === 0) {
            throw new Error("AI returned invalid structure");
        }

        task.subTasks = subTasks.slice(0, 5);
        await task.save();
        
        // Return with Urgency
        const taskObj = task.toObject();
        taskObj.urgencyScore = calculateUrgency(taskObj);
        taskObj.modelUsed = modelUsed;
        
        console.log(`✅ Breakdown Generated via ${modelUsed}`);
        res.json(taskObj);

    } catch (aiError) {
        console.error("Gemini Breakdown Error:", aiError.message);
        
        // Check for Quota Limits (429)
        const isQuotaError = aiError.message.includes('429') || aiError.message.includes('exhausted') || aiError.message.includes('quota');
        
        if (isQuotaError) {
             console.warn("⚠️ Quota Exceeded. Switching to graceful offline mode.");
        }

        // ULTIMATE FALLBACK: Generic Steps (Always succeed)
        try {
            console.log("⚠️ Switching to offline static breakdown.");
            const staticSteps = [
                `Plan initial approach for "${task.title}"`,
                "Execute core requirements (Offline Mode)",
                "Review and finalize"
            ];
            
            task.subTasks = staticSteps;
            await task.save();
            
            const taskObj = task.toObject();
            taskObj.urgencyScore = calculateUrgency(taskObj);
            taskObj.modelUsed = isQuotaError ? "offline-quota" : "offline-error";
            
            // Allow success (200) even on error, so UI updates
            res.json(taskObj);
        } catch (saveError) {
             console.error("Critical: Failed to save fallback.", saveError);
             res.status(500).json({ error: "System Error: Could not save task." });
        }
    }

  } catch (error) {
    console.error("Server Error (Breakdown Route):", error);
    res.status(500).json({ error: 'Internal Server Error during Breakdown' });
  }
});

// Dynamic Date Sorting Route
app.get('/api/tasks/by-date', async (req, res) => {
    try {
        const tasks = await Task.find({ status: { $ne: 'done' } }).lean(); // Exclude done
        
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const nextWeekRaw = new Date(now);
        nextWeekRaw.setDate(now.getDate() + 7);
        const nextWeek = new Date(nextWeekRaw.setHours(23, 59, 59, 999));
        
        const grouped = {
            overdue: [],
            today: [],
            upcoming: [],
            future: []
        };

        tasks.forEach(t => {
            // Attach score
            t.urgencyScore = calculateUrgency(t);
            
            if (!t.dueDate) {
                grouped.future.push(t); // No date = Future/Later
                return;
            }
            const date = new Date(t.dueDate);
            
            if (date < startOfToday) {
                grouped.overdue.push(t);
            } else if (date >= startOfToday && date <= endOfToday) {
                grouped.today.push(t);
            } else if (date > endOfToday && date <= nextWeek) {
                grouped.upcoming.push(t);
            } else {
                grouped.future.push(t);
            }
        });
        
        // Sort each group
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

// Get Daily Game Plan (AI Summary)
app.get('/api/daily-plan', async (req, res) => {
  try {
    const tasks = await Task.find({ status: { $ne: 'done' } }).sort({ urgencyScore: -1 }); 
    
    // If no tasks, return early
    if (tasks.length === 0) {
       return res.json({ message: "No tasks pending. You have a clean slate for the day!" });
    }

    let message = "Loading your daily intelligence...";
    let modelUsed = null;

    try {
        // Create a dense summary for the AI
        const taskDigest = tasks.slice(0, 10).map(t => `- [${t.priority}] ${t.title}`).join('\n');
        const remaining = tasks.length > 10 ? `...and ${tasks.length - 10} more.` : '';
        
        const userPrompt = `
          You are an elite productivity executive assistant.
          Analyze my tasks for today and give me a 1-2 sentence "Morning Briefing".
          
          Tasks:
          ${taskDigest}
          ${remaining}
          
          Goal: Summarize the day's main focus or theme. Be professional, concise, and motivating. Mention the most critical item if it exists.
        `;
        
        // Use Fallback Generator
        const result = await generateWithFallback(userPrompt, false);
        message = result.text;
        modelUsed = result.modelUsed;
        console.log("✅ Daily Plan AI Success. Model:", modelUsed);

    } catch (aiError) {
        console.error("Gemini Error (Daily Plan):", aiError.message);
        console.log("❌ Daily Plan AI Failed. Using offline fallback.");
        // Fallback: Smart stats
        const highPri = tasks.filter(t => t.priority === 'High' || t.priority === 'Critical Hit').length;
        message = `You have ${tasks.length} tasks on deck today` + (highPri > 0 ? `, including ${highPri} priority items.` : '.');
    }

    res.json({ message, modelUsed });
  } catch (error) {
      console.error("Error generating daily plan:", error);
      res.json({ message: "Ready to conquer your tasks?" });
  }
});

// Analyze Today's Work (Specific Strategy)
app.post('/api/analyze-today', async (req, res) => {
  try {
    const { tasks } = req.body;
    
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return res.json({ message: "You're all clear for today! Enjoy your freedom." });
    }

    // Prepare Context
    const taskList = tasks.map(t => `- [${t.priority}] ${t.title} (Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'Today'})`).join('\n');

    const prompt = `
      You are a strategic project manager. 
      Review this list of tasks for today:
      ${taskList}
      
      Give me a "Daily Execution Briefing" (max 2 sentences).
      1. Summarize the workload intensity.
      2. Direct me specifically on where to start for maximum impact.
    `;

    try {
        const { text: strategy, modelUsed: aiModel } = await generateWithFallback(prompt, false);
        console.log("✅ Analyze Today AI Success. Model:", aiModel);
        res.json({ message: strategy, modelUsed: aiModel });

    } catch (aiError) {
        console.error("Gemini Error (Analyze Today):", aiError.message);
        console.log("❌ Analyze Today AI Failed. Using offline fallback.");
        if (aiError.message.includes('exhausted')) {
             return res.status(429).json({ error: "AI is resting (Quota). Try again in a minute." });
        }
        
        // Smart Fallback
        const critical = tasks.find(t => t.priority === 'Critical Hit');
        const high = tasks.find(t => t.priority === 'High');
        const startTask = critical || high || tasks[0];
        
        const fallback = `Focus is key. Start with "${startTask.title}" to set the tempo for the rest of your ${tasks.length} tasks.`;
        
        res.json({ message: fallback });
    }

  } catch (error) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: "Failed to analyze tasks." });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

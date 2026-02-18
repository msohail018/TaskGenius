require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Task = require('./models/Task');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Connect to MongoDB
console.log("Connecting to MongoDB at", process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => {
      console.error('MongoDB Connection Error:', err.message);
  });

// Initialize Gemini
// Ensure you have GEMINI_API_KEY in your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
    try {
      const model = genAI.getGenerativeModel({ 
          model: "gemini-3-flash-preview", 
          generationConfig: { responseMimeType: "application/json" }
      });
      
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

      const result = await model.generateContent(prompt);
      const analysis = JSON.parse(result.response.text());
      
      console.log("Magic Mode Result:", JSON.stringify(analysis, null, 2));

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
      
      return res.status(201).json(taskObj);

    } catch (aiError) {
      console.error("Gemini Error (Magic Mode):", aiError.message);
      // NO FALLBACKS. Return the Real Error.
      if (aiError.message.includes('429')) {
          return res.status(429).json({ error: "AI Quota Exceeded. Please switch to Manual Mode." });
      }
      return res.status(500).json({ error: "AI Service Error. Please use Manual Mode.", details: aiError.message });
    }

  } catch (error) {
    console.error("Create task error:", error);
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

    // Use Gemini 2.5 Flash as requested
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", 
        generationConfig: { responseMimeType: "application/json" } 
    });
    
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
      Limit: Generate 3-5 concise bullet points.
      Return ONLY a JSON Array of strings.
      Example: ["Research requirements", "Draft outline", "Review", "Refine"]
    `;

    try {
        const result = await model.generateContent(prompt);
        const subTasks = JSON.parse(result.response.text());

        if (!Array.isArray(subTasks) || subTasks.length === 0) {
            throw new Error("AI returned invalid structure");
        }

        task.subTasks = subTasks.slice(0, 5);
        await task.save();
        
        // Return with Urgency
        const taskObj = task.toObject();
        taskObj.urgencyScore = calculateUrgency(taskObj);
        
        res.json(taskObj);

    } catch (aiError) {
        console.error("Gemini Generate/Parse Error:", aiError.message);
        
        let errorMessage = "AI Service is busy. Please try again.";
        if (aiError.message.includes('429')) {
            errorMessage = "AI Quota Exceeded. Please try again in 60 seconds.";
        } else if (aiError.message.includes('500') || aiError.message.includes('503')) {
            errorMessage = "AI Service Temporary Error. Please retry.";
        }

        // Return 429 if it's a quota issue, otherwise 400/500
        const status = aiError.message.includes('429') ? 429 : 400;
        res.status(status).json({ error: errorMessage });
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
    const tasks = await Task.find({ status: { $ne: 'done' } }); 
    const highPriority = tasks.filter(t => t.priority === 'High');
    
    let message = "Let's crush it today! Focus on your high priority items.";
    
    if (highPriority.length > 0) {
        try {
            const tasksSummary = highPriority.map(t => `- ${t.title}`).join('\n');
            const userPrompt = `
              You are a motivational productivity coach.
              Generate a motivational greeting and a very brief summary of these high priority tasks for the day:
              ${tasksSummary}
              
              Keep it short, punchy, and under 2 sentences.
            `;

            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(userPrompt);
            message = result.response.text();
        } catch (aiError) {
            console.error("Gemini Error (Daily Plan):", aiError.message);
            message = `You have ${highPriority.length} high priority tasks today. Let's get them done!`;
        }
    }

    res.json({ message });
  } catch (error) {
      console.error("Error generating daily plan:", error);
      // Return default message instead of 500
      res.json({ message: "Welcome back! Ready to conquer your tasks?" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

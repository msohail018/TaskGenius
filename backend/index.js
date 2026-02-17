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

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new task (AI assigns energyLevel, Priority, and Category)
app.post('/api/tasks', async (req, res) => {
  const { title, description, priority, dueDate } = req.body;

  try {
    let energyLevel = 'Admin';
    let suggestedPriority = priority;
    let category = 'Upcoming';

    try {
      const model = genAI.getGenerativeModel({ 
          model: "gemini-2.5-flash", 
          generationConfig: { responseMimeType: "application/json" }
      });
      
      const prompt = `
        Analyze this task. Return a JSON object with:
        1. 'energyLevel': either "Deep Work" or "Admin".
        2. 'suggestedPriority': "Critical Hit" (if urgent/important), "High", "Medium", "Low", or "Backburner".
        3. 'category': "Today" (if urgent), "Tomorrow", or "Upcoming".
        
        Task: "${title}"
        Description: "${description || ''}"
        DueDate: "${dueDate || ''}"
        UserPriority: "${priority}"
        
        Example JSON: {"energyLevel": "Deep Work", "suggestedPriority": "High", "category": "Today"}
      `;

      const result = await model.generateContent(prompt);
      const analysis = JSON.parse(result.response.text());
      
      if (analysis.energyLevel) energyLevel = analysis.energyLevel;
      if (analysis.suggestedPriority) suggestedPriority = analysis.suggestedPriority;
      if (analysis.category) category = analysis.category;

    } catch (aiError) {
      console.error("Gemini Error (Create Task):", aiError.message);
      if (description && description.length > 50) energyLevel = 'Deep Work';
    }

    const newTask = new Task({
      title,
      description,
      priority: suggestedPriority || priority,
      energyLevel,
      category,
      dueDate,
      status: 'todo',
      subTasks: []
    });

    await newTask.save();
    res.status(201).json(newTask);
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({ error: 'Server error creating task' });
  }
});

// Update task status or details
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
      Limit: Exactly 5 highly specific, actionable steps.
      Return ONLY a JSON Array of strings.
      Example: ["Research requirements", "Draft outline", "Review", "Refine", "Submit"]
    `;

    try {
        const result = await model.generateContent(prompt);
        const subTasks = JSON.parse(result.response.text());

        if (!Array.isArray(subTasks) || subTasks.length === 0) {
            throw new Error("AI returned invalid structure");
        }

        task.subTasks = subTasks.slice(0, 5);
        await task.save();
        res.json(task);

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
        const tasks = await Task.find({ status: { $ne: 'done' } }); // Exclude done
        
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

const mongoose = require('mongoose');

const SubTaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
});
// Using simple string array as per prompt: "subTasks (Array of Strings)"
// Wait, prompt says: "subTasks (Array of Strings)".
// Let's stick strictly to prompt: "subTasks (Array of Strings)"

const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low', 'Critical Hit', 'Backburner'],
    default: 'Medium',
  },
  energyLevel: {
    type: String,
    enum: ['Deep Work', 'Admin'],
  },
  status: {
    type: String,
    enum: ['todo', 'in-progress', 'done'],
    default: 'todo',
  },
  subTasks: {
    type: [String], 
    default: [],
  },
  dueDate: {
    type: Date,
  },
  category: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model('Task', TaskSchema);

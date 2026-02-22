const mongoose = require('mongoose');
require('dotenv').config();

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  priority: { type: String, default: 'Medium' },
  status: { type: String, default: 'todo' },
  createdAt: { type: Date, default: Date.now },
});

const Task = mongoose.model('TaskTest', TaskSchema);

async function testConnection() {
  console.log("Attempting to connect to MongoDB...");
  console.log("URI:", process.env.MONGODB_URI ? "Found" : "Missing");
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log("✅ MongoDB connected successfully");
    
    const testTask = new Task({ title: "Test Task from Script" });
    await testTask.save();
    console.log("✅ Test Task created successfully");
    
    await Task.deleteOne({ _id: testTask._id });
    console.log("✅ Test Task deleted successfully");
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Test Failed:", err.message);
    process.exit(1);
  }
}

testConnection();

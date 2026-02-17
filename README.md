
# TaskGenius

**TaskGenius** is a professional full-stack web application designed for software startups to help users overcome "Task Paralysis". It leverages AI to break down large goals into actionable steps and assigns energy levels to tasks for optimal scheduling.

## Features

- **AI-Powered Task Breakdown**: Automatically generates 5 actionable sub-tasks for any main task using GPT-4o-mini.
- **Energy Level Scoring**: AI analyzes task descriptions to assign "Deep Work" or "Admin" labels.
- **Daily Game Plan**: AI-generated greeting and summary of high-priority tasks.
- **Kanban Board UI**: Organize tasks into "To Do", "In Progress", and "Done".
- **Responsive Design**: Professional UI built with React and Tailwind CSS.

## Tech Stack

- **Frontend**: React (Vite), Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas (Mongoose)
- **AI**: OpenAI API (GPT-4o-mini)

## Prerequisites

- **Node.js** (v14+)
- **MongoDB** (Local or Atlas URI)
- **OpenAI API Key**

## Installation & Setup

1. **Clone the repository** (if applicable) or navigate to the project root.

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   # Create a .env file based on the example below
   ```

   **backend/.env**:
   ```env
   MONGODB_URI=mongodb://localhost:27017/taskgenius
   OPENAI_API_KEY=your_openai_key_here
   PORT=5000
   ```

   Start the backend server:
   ```bash
   npm start
   # or
   node index.js
   ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   ```

   Start the frontend development server:
   ```bash
   npm run dev
   ```

4. **Access the App**:
   Open your browser and navigate to the URL provided by Vite (usually `http://localhost:5173`).

## Project Structure

- `frontend/`: React application logic and UI components.
- `backend/`: Express server, API routes, and database models.

---
Built for Software Startups.

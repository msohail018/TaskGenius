import React, { useState, useEffect } from 'react';
import api from './api';
import Column from './components/Column';
import NewTaskForm from './components/NewTaskForm';
import TaskCard from './components/TaskCard';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import { PlusIcon, SunIcon, ListBulletIcon, CheckCircleIcon, ClockIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyGreeting, setDailyGreeting] = useState('');
  const [analysisResult, setAnalysisResult] = useState(''); // Store specific analysis
  const [showForm, setShowForm] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showStrategy, setShowStrategy] = useState(true);
  
  // Unified Tabs for Mobile: 'todo', 'in-progress', 'done'
  const [activeTab, setActiveTab] = useState('todo');
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── Global Keyboard Shortcuts ──
  useKeyboardShortcuts([
    { key: 'n', action: () => setShowForm(true),       },
    { key: 'Escape', action: () => { setShowForm(false); setShowShortcuts(false); }, preventDefault: false },
    { key: '?', action: () => setShowShortcuts(s => !s) },
    { key: 'a', action: () => { if (canAnalyze && !analyzing && countdown === 0) handleAnalyzeToday(); } },
  ]);

  // Fetch tasks
  useEffect(() => {
    fetchTasks();
  }, []);

  // Fetch Daily Game Plan on load (Default)
  useEffect(() => {
    fetchDailyPlan();
  }, []); 

  const fetchTasks = async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(res.data);
    } catch (error) {
      console.error("Error fetching tasks", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyPlan = async () => {
    try {
      const res = await api.get('/daily-plan');
      setDailyGreeting(res.data.message);
    } catch (error) {
      console.error("Error fetching daily plan", error);
    }
  };

  const handleAnalyzeToday = async () => {
    if (analyzing || countdown > 0) return;

    // Include ALL pending tasks with a due date — overdue, today, AND future
    const relevantTasks = tasks.filter(t => {
        if (t.status === 'done') return false;
        if (!t.dueDate) return false;
        return true;
    });

    if (relevantTasks.length === 0) {
        alert("No pending tasks with a due date found to analyze!");
        return;
    }

    setAnalyzing(true);
    setCountdown(15);

    const timer = setInterval(() => {
        setCountdown(prev => {
            if (prev <= 1) { clearInterval(timer); return 0; }
            return prev - 1;
        });
    }, 1000);

    try {
        const res = await api.post('/analyze-today', { tasks: relevantTasks });
        setAnalysisResult(res.data.message);
    } catch (error) {
        console.error("Analysis failed", error);
        alert(error.response?.data?.error || "AI could not analyze. Try again later.");
    } finally {
        setAnalyzing(false);
    }
  };

  const handleTaskCreated = () => {
    // Re-fetch all tasks to ensure correct server-side sorting
    fetchTasks();
    setShowForm(false);
  };

  const handleTaskUpdate = (updatedTask) => {
    setTasks(tasks.map(t => t._id === updatedTask._id ? updatedTask : t));
  };

  const handleTaskDelete = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
        await api.delete(`/tasks/${taskId}`);
        setTasks(tasks.filter(t => t._id !== taskId));
    } catch (error) {
        console.error("Error deleting task", error);
    }
  };

  const TabButton = ({ id, label, icon: Icon, colorClass }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-3 text-sm font-medium transition-all relative ${
        activeTab === id ? 'text-gray-900 bg-white/50' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <div className="flex items-center justify-center gap-2 relative z-10">
        <Icon className={`h-5 w-5 ${activeTab === id ? colorClass : ''}`} />
        <span>{label}</span>
      </div>
      {activeTab === id && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 rounded-t-full transition-all"></span>
      )}
    </button>
  );

  // Helper: Button enabled if ANY non-done task with a dueDate exists
  const hasTasksForToday = () => {
      return tasks.some(t => t.status !== 'done' && t.dueDate);
  };

  const canAnalyze = hasTasksForToday();
  
  const todoTasks = tasks.filter(t => t.status === 'todo');
  const doingTasks = tasks.filter(t => t.status === 'in-progress');
  
  // Calculate Urgency Buckets (Only for ToDo)
  const urgencyStats = todoTasks.reduce((acc, t) => {
      const score = t.urgencyScore || 0;
      if (score >= 8) acc.critical++;       // Red: Today/Overdue
      else if (score >= 5) acc.high++;      // Orange: Tomorrow/High Priority
      else acc.normal++;                    // Green: Everything else
      return acc;
  }, { critical: 0, high: 0, normal: 0 });

  // Dynamic Offline Greeting Logic
  let dynamicGreeting = "";
  if (todoTasks.length === 0 && doingTasks.length === 0) {
      dynamicGreeting = "🎉 You're all caught up! No pending tasks. Enjoy your freedom!";
  } else if (todoTasks.length === 0 && doingTasks.length > 0) {
      dynamicGreeting = `🚀 You have ${doingTasks.length} tasks in progress. Focus and finish them strong!`;
  } else {
      // Has ToDo Tasks
      dynamicGreeting = urgencyStats.critical > 0 
      ? `🚨 Action Required: You have ${urgencyStats.critical} critical tasks that need attention right now.` 
      : `You have ${urgencyStats.high} high priority tasks upcoming. Keep the momentum going!`;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-900 overflow-x-hidden">

      {/* ── Keyboard Shortcuts Help Panel ── */}
      {showShortcuts && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowShortcuts(false); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-sm animate-fade-in-down">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">⌨️</span> Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setShowShortcuts(false)}
                aria-label="Close keyboard shortcuts panel"
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { keys: ['N'],           desc: 'Open New Task form' },
                { keys: ['A'],           desc: "Analyze Today's Work" },
                { keys: ['?'],           desc: 'Toggle this shortcuts panel' },
                { keys: ['Esc'],         desc: 'Close any open panel / form' },
                { keys: ['Ctrl', 'Enter'], desc: 'Submit the open form' },
                { keys: ['Tab'],           desc: 'Navigate between elements' },
                { keys: ['Enter', 'Space'], desc: 'Activate focused button' },
              ].map(({ keys, desc }) => (
                <div key={desc} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">{desc}</span>
                  <div className="flex items-center gap-1">
                    {keys.map(k => (
                      <kbd key={k} className="px-2 py-1 text-[11px] font-bold bg-gray-100 border border-gray-300 rounded-md text-gray-700 shadow-sm font-mono">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-[11px] text-gray-400 text-center">
              Shortcuts are disabled while typing in input fields.
            </p>
          </div>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center relative">
          {/* Centered Branding */}
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-50">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <div className="flex flex-col items-start justify-center">
                <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-900 tracking-tighter leading-none">
                    TaskGenius <span className="text-indigo-600">V2</span>
                </h1>
                <span className="text-[0.6rem] font-extrabold text-indigo-500 uppercase tracking-widest mt-0.5 ml-0.5">
                    AI POWERED
                </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 ml-auto">
              {/* Keyboard Shortcut Hint */}
              <button
                onClick={() => setShowShortcuts(true)}
                aria-label="Show keyboard shortcuts (press ?)"
                title="Keyboard Shortcuts (?)"
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-400 border border-gray-200 hover:text-gray-600 hover:bg-gray-50 transition-all"
              >
                <kbd className="font-mono text-xs">?</kbd>
                <span>Shortcuts</span>
              </button>

              {/* Analyze Today Button (Desktop & Mobile) */}
              <button
                onClick={handleAnalyzeToday}
                disabled={analyzing || countdown > 0 || !canAnalyze}
                aria-label={!canAnalyze ? "Analyze — no pending tasks with a due date" : "Analyze All Tasks (press A)"}
                aria-busy={analyzing}
                className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                    countdown > 0 || !canAnalyze
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                    : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm'
                }`}
              >
                  <SparklesIcon className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
                  {countdown > 0 ? `Strategizing... (${countdown}s)` : "Analyze All Tasks"}
              </button>

              {/* New Task Button */}
              <button 
                onClick={() => setShowForm(!showForm)}
                aria-label="New Task (press N)"
                aria-expanded={showForm}
                className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg transform active:scale-95"
              >
                <PlusIcon className="h-5 w-5" aria-hidden="true" />
                <span className="hidden md:inline">New Task</span>
              </button>
          </div>
        </div>
      </header>

      {/* Unified Mobile Tab Navigation: Status Based */}
      <div className="md:hidden bg-white border-b border-gray-100 flex justify-around sticky top-16 z-10 shadow-sm">
        <TabButton id="todo" label="To Do" icon={ListBulletIcon} colorClass="text-indigo-500" />
        <TabButton id="in-progress" label="Doing" icon={ClockIcon} colorClass="text-amber-500" />
        <TabButton id="done" label="Done" icon={CheckCircleIcon} colorClass="text-emerald-500" />
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex flex-col">
        
        {/* Mobile Analyze Button */}
        <div className="md:hidden mb-6">
            <button
                onClick={handleAnalyzeToday}
                disabled={analyzing || countdown > 0 || !canAnalyze}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border transition-all shadow-sm ${
                    countdown > 0 || !canAnalyze
                    ? 'bg-gray-100 text-gray-400 border-gray-200' 
                    : 'bg-white text-indigo-600 border-indigo-200 active:bg-indigo-50'
                }`}
            >
                <SparklesIcon className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
                {countdown > 0 ? `Strategizing... (${countdown}s)` : "✨ Analyze All Tasks"}
            </button>
        </div>

        {/* Daily Briefing / Analysis Box (AI) */}
        {showStrategy && (
             <div className={`mb-8 rounded-2xl p-6 md:p-8 text-white shadow-xl ring-1 ring-white/20 relative overflow-hidden transition-all animate-fade-in-down ${
                 analysisResult 
                 ? 'bg-gradient-to-br from-slate-800 to-slate-900 shadow-slate-300' 
                 : 'bg-gradient-to-tr from-indigo-700 to-violet-700 shadow-indigo-300'
             }`}>
                {/* Background Decor */}
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
                
                {/* Close / Back Button */}
                <button 
                    onClick={() => {
                        if (analysisResult) setAnalysisResult(''); // Revert to offline
                        else setShowStrategy(false); // Close box
                    }}
                    className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-all z-20 group"
                    aria-label={analysisResult ? "Back to Daily Briefing" : "Close Strategy"}
                >
                    {analysisResult ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                    ) : (
                        <XMarkIcon className="w-5 h-5" />
                    )}
                </button>

                <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-center">
                    {/* Left Side: Icon & Text */}
                    <div className="flex gap-4 items-start flex-1">
                        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm shrink-0">
                            <SparklesIcon className={`h-8 w-8 ${analysisResult ? 'text-emerald-300' : 'text-yellow-300'}`} />
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold mb-2 tracking-tight text-white flex items-center gap-2">
                                {analysisResult ? "Your Today Strategy" : (
                                    <>
                                        {urgencyStats.critical > 0 && <span className="bg-red-500 text-white text-sm font-black px-2 py-1 rounded-lg uppercase tracking-wider">URGENT</span>}
                                        <span>Daily Briefing</span>
                                    </>
                                )}
                            </h2>
                            <p className="opacity-95 leading-relaxed text-indigo-50 max-w-2xl text-base md:text-lg font-light">
                                {analysisResult || dynamicGreeting}
                            </p>
                        </div>
                    </div>

                    {/* Right Side: Urgency Bubbles (Always Visible) */}
                    <div className="flex items-center gap-3 shrink-0">
                        {/* Critical Bubble */}
                        {urgencyStats.critical > 0 && (
                            <div className="flex flex-col items-center gap-1 group">
                                <div className="w-12 h-12 rounded-full bg-rose-500 border-2 border-rose-300 shadow-lg flex items-center justify-center text-xl font-black text-white transform group-hover:scale-110 transition-transform">
                                    {urgencyStats.critical}
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-200">Critical</span>
                            </div>
                        )}

                        {/* High Bubble */}
                        {urgencyStats.high > 0 && (
                            <div className="flex flex-col items-center gap-1 group">
                                <div className="w-12 h-12 rounded-full bg-amber-500 border-2 border-amber-300 shadow-lg flex items-center justify-center text-xl font-black text-white transform group-hover:scale-110 transition-transform">
                                    {urgencyStats.high}
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200">High</span>
                            </div>
                        )}

                             {/* Normal Bubble */}
                             {urgencyStats.normal > 0 && (
                                <div className="flex flex-col items-center gap-1 group">
                                    <div className="w-12 h-12 rounded-full bg-emerald-500 border-2 border-emerald-300 shadow-lg flex items-center justify-center text-xl font-black text-white transform group-hover:scale-110 transition-transform">
                                        {urgencyStats.normal}
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Normal</span>
                                </div>
                            )}
                        </div>
                    </div>
             </div>
        )}

        {/* New Task Form (Inline) */}
        {showForm && (
            <div className="mb-8 animate-fade-in-down">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 relative overflow-hidden">
                    <button 
                        onClick={() => setShowForm(false)} 
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-50 bg-white/50 rounded-full p-1"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                    <NewTaskForm onTaskCreated={handleTaskCreated} onClose={() => setShowForm(false)} tasks={tasks} />
                </div>
            </div>
        )}

        {/* Tasks Display */}
        {loading ? (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        ) : (
            <>
                {/* Mobile View: Unified Status Lists */}
                <div className="md:hidden space-y-4">
                    {(() => {
                        const statusTasks = tasks.filter(t => t.status === activeTab);
                        
                        // Sort by Urgency Score Descending (should be default from API, but double check)
                        // statusTasks.sort((a,b) => b.urgencyScore - a.urgencyScore); 

                        return (
                            <div className="space-y-4 animate-fade-in">
                                {statusTasks.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                                        <ListBulletIcon className="h-10 w-10 mb-2 opacity-20" />
                                        <p>No tasks in {activeTab}</p>
                                    </div>
                                ) : (
                                    statusTasks.map(task => (
                                        <TaskCard 
                                            key={task._id} 
                                            task={task} 
                                            onUpdate={handleTaskUpdate} 
                                            onDelete={handleTaskDelete} 
                                        />
                                    ))
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* Desktop View: Kanban Board */}
                <div className="hidden md:flex flex-row gap-6 items-start">
                    <div className="flex-1 h-full">
                        <Column 
                            title="To Do" 
                            status="todo"
                            tasks={tasks.filter(t => t.status === 'todo')} 
                            onTaskUpdate={handleTaskUpdate}
                            onTaskDelete={handleTaskDelete}
                        />
                    </div>
                    <div className="flex-1 h-full">
                        <Column 
                            title="Doing" 
                            status="in-progress"
                            tasks={tasks.filter(t => t.status === 'in-progress')} 
                            onTaskUpdate={handleTaskUpdate}
                            onTaskDelete={handleTaskDelete}
                        />
                    </div>
                    <div className="flex-1 h-full">
                        <Column 
                            title="Done" 
                            status="done"
                            tasks={tasks.filter(t => t.status === 'done')} 
                            onTaskUpdate={handleTaskUpdate}
                            onTaskDelete={handleTaskDelete}
                        />
                    </div>
                </div>
            </>
        )}
      </main>

      {/* Floating Action Button (Mobile Only) */}
      <button
        onClick={() => setShowForm(true)}
        className="md:hidden fixed bottom-6 right-6 h-14 w-14 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-400/50 flex items-center justify-center hover:bg-indigo-700 transition-transform active:scale-95 z-50 border-2 border-white/20"
        aria-label="Create new task"
      >
        <PlusIcon className="h-7 w-7" />
      </button>

    </div>
  );
}

export default App;

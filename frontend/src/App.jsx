import React, { useState, useEffect } from 'react';
import api from './api';
import Column from './components/Column';
import NewTaskForm from './components/NewTaskForm';
import TaskCard from './components/TaskCard';
import { PlusIcon, SunIcon, ListBulletIcon, ClockIcon, CheckCircleIcon, CalendarIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyGreeting, setDailyGreeting] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('today'); // 'overdue', 'today', 'upcoming', 'done'

  // Fetch tasks
  useEffect(() => {
    fetchTasks();
  }, []);

  // Fetch Daily Game Plan on load
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

  const handleTaskCreated = (newTask) => {
    setTasks([...tasks, newTask]);
    setShowForm(false);
    if (newTask.priority === 'High') fetchDailyPlan();
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
        activeTab === id ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <div className="flex items-center justify-center gap-2 relative z-10">
        <Icon className={`h-5 w-5 ${activeTab === id ? colorClass : ''}`} />
        <span>{label}</span>
      </div>
      {activeTab === id && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-indigo-600 rounded-t-full transition-all"></span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-900 overflow-x-hidden">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2 rounded-lg shadow-lg shadow-indigo-200">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">TaskGenius</h1>
          </div>
          {/* Desktop New Task Button */}
          <button 
            onClick={() => setShowForm(!showForm)}
            className="hidden md:flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg transform active:scale-95"
          >
            <PlusIcon className="h-5 w-5" />
            New Task
          </button>
        </div>
      </header>

      {/* Mobile Tab Navigation */}
      <div className="md:hidden bg-white border-b border-gray-100 flex justify-around sticky top-16 z-10 shadow-sm overflow-x-auto no-scrollbar">
        <TabButton id="overdue" label="Overdue" icon={ExclamationTriangleIcon} colorClass="text-red-500" />
        <TabButton id="today" label="Today" icon={SunIcon} colorClass="text-orange-500" />
        <TabButton id="upcoming" label="Upcoming" icon={CalendarIcon} colorClass="text-blue-500" />
        <TabButton id="done" label="Done" icon={CheckCircleIcon} colorClass="text-emerald-500" />
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex flex-col">
        {/* Daily Greeting */}
        {dailyGreeting && (
             <div className="mb-8 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 md:p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden transition-all">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
                <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-indigo-400 opacity-20 rounded-full blur-xl"></div>
                <SunIcon className="absolute top-6 right-6 h-12 w-12 text-white opacity-20" />
                <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">Daily Game Plan</h2>
                <p className="opacity-90 leading-relaxed text-indigo-50 max-w-2xl text-base md:text-lg font-light">{dailyGreeting}</p>
             </div>
        )}

        {/* New Task Form (Inline) */}
        {showForm && (
            <div className="mb-8 animate-fade-in-down">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 relative overflow-hidden">
                    <button 
                        onClick={() => setShowForm(false)} 
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                    <NewTaskForm onTaskCreated={handleTaskCreated} onClose={() => setShowForm(false)} />
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
                {/* Mobile View: Deadline/Status Lists */}
                <div className="md:hidden space-y-4">
                    {(() => {
                        const now = new Date();
                        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

                        let mobileTasks = [];
                        if (activeTab === 'done') {
                            mobileTasks = tasks.filter(t => t.status === 'done');
                        } else {
                            const activeTasks = tasks.filter(t => t.status !== 'done');
                            if (activeTab === 'overdue') {
                                mobileTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < startOfToday);
                            } else if (activeTab === 'today') {
                                mobileTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) >= startOfToday && new Date(t.dueDate) <= endOfToday);
                            } else if (activeTab === 'upcoming') {
                                mobileTasks = activeTasks.filter(t => !t.dueDate || new Date(t.dueDate) > endOfToday);
                            }
                        }

                        // Mobile Rendering using Column component logic but flat
                        return (
                            <div className="space-y-4 animate-fade-in">
                                {mobileTasks.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400">
                                        <p>No tasks in {activeTab}</p>
                                    </div>
                                ) : (
                                    mobileTasks.map(task => (
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
                            title="In Progress" 
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

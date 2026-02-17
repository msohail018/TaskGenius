import React, { useState } from 'react';
import api from '../api';
import { TrashIcon, SparklesIcon, CheckCircleIcon, CalendarIcon, ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/outline';

const priorityColors = {
  High: 'bg-rose-100 text-rose-800 border-rose-200',
  Medium: 'bg-amber-100 text-amber-800 border-amber-200',
  Low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Critical Hit': 'bg-red-600 text-white border-red-700 shadow-md shadow-red-200 animate-pulse-slow',
  'Backburner': 'bg-slate-100 text-slate-500 border-slate-200',
};

const energyColors = {
  'Deep Work': 'bg-violet-100 text-violet-800 border-violet-200',
  'Admin': 'bg-sky-100 text-sky-800 border-sky-200',
};

const TaskCard = ({ task, onUpdate, onDelete }) => {
  const [loadingAI, setLoadingAI] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    try {
        const response = await api.put(`/tasks/${task._id}`, { status: newStatus });
        onUpdate(response.data);
    } catch (err) {
        console.error("Update failed", err);
    }
  };

  const handleBreakdown = async () => {
    if (loadingAI || cooldown > 0) return;
    setLoadingAI(true);
    
    // Start cooldown immediately to prevent double clicks
    setCooldown(10);
    const interval = setInterval(() => {
        setCooldown((prev) => {
            if (prev <= 1) {
                clearInterval(interval);
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
    
    // 15s timeout
    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Request timed out")), 15000)
    );

    try {
      const res = await Promise.race([
        api.post(`/tasks/${task._id}/breakdown`),
        timeout
      ]);
      onUpdate(res.data);
    } catch (err) {
      console.error("AI Breakdown failed:", err);
      // Show specific error from backend if available
      const msg = err.response?.data?.error || "AI Service is busy. Please try again.";
      alert(`AI Error: ${msg}`);
    } finally {
      setLoadingAI(false);
    }
  };

  const isCritical = task.priority === 'Critical Hit' || task.priority === 'High';
  
  // Format deadline relative to today
  const getDeadlineStatus = (dateString) => {
      if (!dateString) return null;
      const date = new Date(dateString);
      const today = new Date();
      today.setHours(0,0,0,0);
      const diffTime = date - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return { label: 'Overdue', color: 'text-red-600 font-bold' };
      if (diffDays === 0) return { label: 'Today', color: 'text-orange-600 font-bold' };
      if (diffDays === 1) return { label: 'Tomorrow', color: 'text-amber-600' };
      if (diffDays <= 7) return { label: `${diffDays} days left`, color: 'text-blue-600' };
      return { label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), color: 'text-gray-500' };
  };

  const deadline = getDeadlineStatus(task.dueDate);

  return (
    <div className={`bg-white p-5 rounded-2xl border border-white/60 shadow-xl shadow-slate-200/50 
        md:hover:shadow-2xl md:hover:shadow-purple-500/10 md:hover:-translate-y-2 transition-all duration-300 
        group ring-1 ring-black/5 md:hover:ring-purple-400/20 relative overflow-hidden
        ${isCritical ? 'ring-rose-100' : ''}
    `}>
      {/* Decorative gradient blob */}
      <div className="absolute -right-10 -top-10 h-32 w-32 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-full blur-2xl md:group-hover:bg-purple-100/50 transition-colors pointer-events-none"></div>

      <div className="relative z-10 flex justify-between items-start mb-3">
        <h3 className={`font-bold text-lg leading-tight tracking-tight ${task.status === 'done' ? 'text-gray-400 line-through decoration-2' : 'text-gray-800'}`}>
            {task.title}
        </h3>
        <button 
            onClick={() => onDelete(task._id)} 
            className="text-gray-400 md:text-gray-300 hover:text-rose-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-3 -mr-2 hover:bg-rose-50 rounded-lg touch-manipulation"
            aria-label="Delete task"
        >
            <TrashIcon className="h-5 w-5" />
        </button>
      </div>
      
      {task.description && (
        <p className="relative z-10 text-sm text-gray-500 mb-5 leading-relaxed font-medium line-clamp-2">{task.description}</p>
      )}

      {/* Meta Tags */}
      <div className="relative z-10 flex gap-2 mb-4 flex-wrap">
        <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border shadow-sm uppercase tracking-wider flex items-center gap-1 ${priorityColors[task.priority] || 'bg-gray-100'}`}>
          {task.priority === 'Critical Hit' && <ExclamationTriangleIcon className="h-3 w-3" />}
          {task.priority}
        </span>
        <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border shadow-sm uppercase tracking-wider ${energyColors[task.energyLevel] || 'bg-gray-100'}`}>
          {task.energyLevel}
        </span>
        {deadline && (
             <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 flex items-center gap-1 ${deadline.color}`}>
                <ClockIcon className="h-3 w-3" />
                {deadline.label}
             </span>
        )}
      </div>

      {/* Subtasks / AI Button */}
      {task.subTasks && task.subTasks.length > 0 ? (
        <div className="relative z-10 mb-4 pl-4 border-l-[3px] border-indigo-500 bg-indigo-50/50 py-3 pr-2 rounded-r-xl">
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <SparklesIcon className="h-3 w-3" /> AI Game Plan
            </p>
            <ul className="text-xs text-gray-700 space-y-2.5 font-medium">
                {task.subTasks.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircleIcon className="h-4 w-4 mt-0.5 text-indigo-500 flex-shrink-0" />
                        <span className="leading-snug">{step}</span>
                    </li>
                ))}
            </ul>
        </div>
      ) : (
        <button 
            onClick={handleBreakdown} 
            disabled={loadingAI || cooldown > 0}
            className={`relative z-10 w-full mb-5 flex items-center justify-center gap-2 text-sm font-bold text-white bg-gradient-to-r 
                ${loadingAI || cooldown > 0 ? 'from-gray-400 to-gray-500 cursor-not-allowed' : 'from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500'} 
                py-3.5 rounded-xl shadow-lg shadow-indigo-200 md:hover:shadow-indigo-300/50 transition-all duration-300 active:scale-95 group/btn touch-manipulation`}
        >
            {loadingAI ? (
                <>
                    <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></span>
                    <span>Analyzing...</span>
                </>
            ) : cooldown > 0 ? (
                <span>Cooling down ({cooldown}s)</span>
            ) : (
                <>
                    <SparklesIcon className="h-4 w-4 text-indigo-100 md:group-hover/btn:text-white transition-colors" />
                    <span>Generate AI Steps</span>
                </>
            )}
        </button>
      )}

      {/* Footer Controls */}
      <div className="relative z-10 pt-3 border-t border-gray-100 flex justify-between items-center">
        <div className="relative">
            <select 
                value={task.status} 
                onChange={handleStatusChange}
                className="appearance-none pl-3 pr-8 py-2 text-xs font-bold bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg text-gray-600 cursor-pointer focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm touch-manipulation"
            >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
        </div>
        <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-md">
            {new Date(task.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
        </span>
      </div>
    </div>
  );
};
export default TaskCard;

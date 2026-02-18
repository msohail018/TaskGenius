import React, { useState } from 'react';
import { 
    CalendarIcon, 
    BoltIcon, 
    CheckCircleIcon, 
    TrashIcon, 
    PlayIcon, 
    CheckIcon,
    SparklesIcon,
    ChevronDownIcon,
    ChevronUpIcon
} from '@heroicons/react/24/outline';
import api from '../api';

const TaskCard = ({ task, onUpdate, onDelete }) => {
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);

  /* New: Collapsible State */
  const [isStepsExpanded, setIsStepsExpanded] = useState(false);

  // Status Colors
  const statusColors = {
    'todo': 'bg-white border-gray-200',
    'in-progress': 'bg-blue-50 border-blue-200 ring-1 ring-blue-100',
    'done': 'bg-emerald-50 border-emerald-200 opacity-80'
  };

  // Priority Badge Logic
  const priorityColors = {
    'Critical Hit': 'bg-rose-100 text-rose-700 ring-rose-500/20',
    'High': 'bg-orange-100 text-orange-700 ring-orange-500/20',
    'Medium': 'bg-yellow-100 text-yellow-700 ring-yellow-500/20',
    'Low': 'bg-green-100 text-green-700 ring-green-500/20',
    'Backburner': 'bg-gray-100 text-gray-500 ring-gray-500/20'
  };

  // Relative Date Formatting
  const getDeadlineDisplay = (isoString) => {
    if (!isoString) return null;
    
    const date = new Date(isoString);
    // Localize YYYY-MM-DD
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() + userTimezoneOffset);
    localDate.setHours(0,0,0,0);
    
    const today = new Date();
    today.setHours(0,0,0,0);

    // Calculate diff in days
    const diffTime = localDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Overdue', color: 'text-red-700 bg-red-50 ring-red-600/20 animate-pulse-red' };
    if (diffDays === 0) return { text: 'Today', color: 'text-orange-700 bg-orange-50 ring-orange-600/20' };
    if (diffDays === 1) return { text: 'Tomorrow', color: 'text-amber-700 bg-amber-50 ring-amber-600/20' };
    if (diffDays <= 7) return { text: `${diffDays} Days Left`, color: 'text-indigo-700 bg-indigo-50 ring-indigo-600/20' };
    
    // Future
    return { 
        text: localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
        color: 'text-gray-600 bg-gray-50 ring-gray-600/20' 
    };
  };

  const deadline = getDeadlineDisplay(task.dueDate);

  // Handle Status Change
  const cycleStatus = async () => {
    const nextStatus = {
        'todo': 'in-progress',
        'in-progress': 'done',
        'done': 'todo'
    };
    const newStatus = nextStatus[task.status];
    
    // Optimistic Update
    onUpdate({ ...task, status: newStatus });

    try {
        await api.put(`/tasks/${task._id}`, { status: newStatus });
    } catch (error) {
        console.error("Status update failed", error);
        onUpdate({ ...task, status: task.status }); // Revert
    }
  };

  // AI Breakdown Logic
  const handleBreakdown = async () => {
    setLoadingAI(true);
    setAiProgress(0);

    const progressInterval = setInterval(() => {
        setAiProgress(prev => {
            if (prev >= 95) return 95; 
            return prev + (100/150); 
        });
    }, 100);

    try {
        const res = await api.post(`/tasks/${task._id}/breakdown`);
        clearInterval(progressInterval);
        setAiProgress(100);
        setTimeout(() => {
            onUpdate(res.data);
            setLoadingAI(false);
        }, 500);

    } catch (error) {
        clearInterval(progressInterval);
        console.error("AI breakdown failed", error);
        if (error.response?.status === 429) {
             alert("AI is resting. Please try again in 30 seconds.");
        } else {
             const msg = error.response?.data?.error || "AI Service Error. Please try again.";
             alert(msg);
        }
        setLoadingAI(false);
    }
  };

  const urgency = task.urgencyScore || 1; 
  let heatBarColor = 'bg-emerald-500';
  if (urgency >= 8) heatBarColor = 'bg-red-500';
  else if (urgency >= 5) heatBarColor = 'bg-amber-500';

  return (
    <div className={`relative group p-4 rounded-xl border shadow-sm hover:shadow-md transition-all duration-300 ${statusColors[task.status]} ${task.priority === 'Critical Hit' ? 'ring-2 ring-rose-100' : ''} animate-fade-in`}>
      
      {/* Urgency Heat Bar */}
      <div className="relative z-10 w-full mb-3">
          <div className="flex justify-between items-end mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <BoltIcon className="h-3 w-3" /> Urgency
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${urgency >= 8 ? 'bg-red-100 text-red-700' : urgency >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`} >
                  {urgency.toFixed(1)}
              </span>
          </div>
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full ${heatBarColor} transition-all duration-1000 ease-out`} 
                style={{ width: `${Math.min((urgency / 10) * 100, 100)}%` }}
              ></div>
          </div>
      </div>

      {/* Header: Priority & Relative Deadline */}
      <div className="flex flex-wrap justify-between items-start mb-2 gap-2 relative z-10">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${priorityColors[task.priority] || 'bg-gray-100 text-gray-500'}`}>
          {task.priority || 'Normal'}
        </span>
        
        {deadline && (
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${deadline.color}`}>
                <CalendarIcon className="h-3 w-3" />
                {deadline.text}
            </span>
        )}
      </div>

      {/* Title & Desc */}
      <div className="relative z-10">
          <h3 className={`font-semibold text-gray-800 leading-snug mb-1 ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
            {task.title}
          </h3>
          {task.description && (
             <p className="text-xs text-gray-500 line-clamp-2 mb-3">{task.description}</p>
          )}
      </div>

      {/* Subtasks / AI Checklist */}
      {task.subTasks && task.subTasks.length > 0 ? (
        <div className="relative z-10 mb-4 bg-indigo-50/50 rounded-xl overflow-hidden border border-indigo-100 transition-all">
            <button 
                onClick={() => setIsStepsExpanded(!isStepsExpanded)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-indigo-50/80 transition-colors"
            >
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                    <SparklesIcon className="h-4 w-4" /> 
                    AI Game Plan ({task.subTasks.length})
                </p>
                {isStepsExpanded ? (
                    <ChevronUpIcon className="h-4 w-4 text-indigo-400" />
                ) : (
                    <ChevronDownIcon className="h-4 w-4 text-indigo-400" />
                )}
            </button>
            
            {isStepsExpanded && (
                <div className="px-4 pb-4 animate-fade-in space-y-2.5 border-t border-indigo-100/50 pt-3">
                    {task.subTasks.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3 group/item cursor-pointer">
                            <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                            <span className="text-xs text-gray-700 font-medium leading-snug group-hover/item:text-indigo-700 transition-colors">{step}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
      ) : (
        <div className="mt-3 relative z-10">
             {loadingAI ? (
                <div className="w-full bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                         <span className="text-[10px] font-bold text-indigo-600 animate-pulse">✨ AI is thinking...</span>
                         <span className="text-[10px] font-medium text-gray-400">{Math.round(aiProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                            className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300 ease-out" 
                            style={{ width: `${aiProgress}%` }}
                        ></div>
                    </div>
                </div>
             ) : (
                task.status !== 'done' && (
                    <button 
                        onClick={handleBreakdown}
                        className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-indigo-200"
                    >
                        <SparklesIcon className="h-3 w-3" /> Generate AI Steps
                    </button>
                )
             )}
        </div>
      )}

      {/* Footer: Permanent Actions (Visible Mobile & Desktop) */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-end relative z-20">
        
        <div className="flex flex-col gap-1">
             <span className="text-[10px] font-medium text-gray-400">
                Created: {new Date(task.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
             </span>
             <button 
                onClick={() => onDelete(task._id)}
                className="text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                title="Delete Task"
            >
                <TrashIcon className="h-3 w-3" /> Delete
            </button>
        </div>

        <button 
            onClick={cycleStatus}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-all transform active:scale-95 border shadow-sm ${
                task.status === 'done' 
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' 
                : 'bg-indigo-600 text-white border-transparent hover:bg-indigo-700 hover:shadow-md'
            }`}
        >
            {task.status === 'done' ? (
                <>
                    <CheckIcon className="h-3.5 w-3.5" /> Reopen
                </>
            ) : task.status === 'in-progress' ? (
                <>
                    <CheckIcon className="h-3.5 w-3.5" /> Complete
                </>
            ) : (
                <>
                    <PlayIcon className="h-3.5 w-3.5" /> Start
                </>
            )}
        </button>
      </div>
    </div>
  );
};

export default TaskCard;

import React, { useState } from 'react';
import api from '../api';
import { SparklesIcon, PlusCircleIcon, PencilSquareIcon, BoltIcon, CalendarDaysIcon } from '@heroicons/react/24/solid';

const NewTaskForm = ({ onTaskCreated, onClose }) => {
  const [mode, setMode] = useState('magic'); // 'magic' or 'manual'
  
  // Magic Mode State
  const [magicText, setMagicText] = useState('');
  
  // Manual Mode State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  
  // Helper to format date as YYYY-MM-DD (Local Timezone Safe)
  const formatDate = (date) => date.toLocaleDateString('en-CA');

  const getToday = () => formatDate(new Date());
  
  const getTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  };
  
  const getThisWeekend = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = 6 - day; // Saturday is 6
    d.setDate(d.getDate() + (diff > 0 ? diff : diff + 7));
    return formatDate(d);
  };
  
  const getNextWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return formatDate(d);
  };

  const [dueDate, setDueDate] = useState(getToday());

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      let payload = {};
      
      if (mode === 'magic') {
          if (!magicText.trim()) return;
          payload = { mode: 'magic', text: magicText };
      } else {
          if (!title.trim()) return;
          payload = { mode: 'manual', title, description, priority, dueDate };
      }

      const response = await api.post('/tasks', payload);
      onTaskCreated(response.data);
      
      // Reset
      setMagicText('');
      setTitle('');
      setDescription('');
      setPriority('Medium');
      setDueDate(getToday());
      
      if (onClose) onClose();

    } catch (err) {
      console.error("Task creation failed", err);
      // Show transparent error from backend
      if (err.response) {
          if (err.response.status === 429) {
              setErrorMsg("⚠️ AI is overloaded (Quota). Please use Manual Mode.");
          } else if (err.response.data && err.response.data.error) {
              setErrorMsg(`⚠️ ${err.response.data.error}`);
          } else {
              setErrorMsg("Failed to create task. Please try again.");
          }
      } else {
          setErrorMsg("Network Error. check connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  const DateButton = ({ label, dateValue }) => (
    <button
      type="button"
      onClick={() => setDueDate(dateValue)}
      className={`px-3 py-1.5 text-xs font-medium border rounded-full transition-all hover:bg-gray-50 
        ${dueDate === dateValue 
            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500 ring-offset-1' 
            : 'border-gray-200 text-gray-600'}`}
    >
      {label}
    </button>
  );

  const PriorityButton = ({ label, value, colorClass, activeClass }) => (
    <button
      type="button"
      onClick={() => setPriority(value)}
      className={`px-3 py-1.5 text-xs font-bold border rounded-full transition-all hover:opacity-80
        ${priority === value 
            ? `ring-2 ring-offset-1 ${activeClass}` 
            : 'border-gray-200 text-gray-500 bg-white'
        }
        ${priority === value ? colorClass : ''}
      `}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 mb-6 animate-fade-in-down transition-all">
      {/* Header & Mode Toggle */}
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <div className={`p-2 rounded-lg transition-colors ${mode === 'magic' ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                {mode === 'magic' ? <SparklesIcon className="h-5 w-5 text-indigo-600" /> : <PencilSquareIcon className="h-5 w-5 text-gray-600" />}
            </div>
            {mode === 'magic' ? 'Magic Task' : 'Manual Entry'}
        </h2>
        
        <div className="flex bg-gray-100 p-1.5 rounded-xl gap-1">
            <button 
                onClick={() => setMode('magic')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'magic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <SparklesIcon className="h-3 w-3" /> Magic
            </button>
            <button 
                onClick={() => setMode('manual')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'manual' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <PencilSquareIcon className="h-3 w-3" /> Manual
            </button>
        </div>
      </div>
      
      {errorMsg && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-lg flex items-center gap-2 animate-pulse">
              <BoltIcon className="h-4 w-4" />
              {errorMsg}
          </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {mode === 'magic' ? (
            /* Magic Mode Input */
            <div className="animate-fade-in">
                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">What do you need to do?</label>
                 <textarea 
                    className="w-full px-4 py-4 border-2 border-indigo-100 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-gray-800 placeholder-indigo-300 font-medium text-lg min-h-[100px]"
                    placeholder="e.g., Pay electric bill tonight..."
                    value={magicText}
                    onChange={(e) => setMagicText(e.target.value)}
                    autoFocus
                    required
                 />
                 <p className="text-[10px] text-gray-400 mt-2 flex justify-end">
                    Auto-detects Deadlines & Priority
                 </p>
            </div>
        ) : (
            /* Professional Manual Mode Inputs */
            <div className="space-y-5 animate-fade-in">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Task Title</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-gray-800 placeholder-gray-400 font-medium"
                    placeholder="Briefly describe the task"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {/* Quick Date Selection */}
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <CalendarDaysIcon className="h-3 w-3" /> Due Date
                    </label>
                    <div className="flex flex-wrap gap-2 items-center">
                        <DateButton label="Today" dateValue={getToday()} />
                        <DateButton label="Tomorrow" dateValue={getTomorrow()} />
                        <DateButton label="Weekend" dateValue={getThisWeekend()} />
                        <DateButton label="Next Week" dateValue={getNextWeek()} />
                        <div className="relative">
                            <input 
                                type="date" 
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className={`px-3 py-1.5 text-xs font-medium border rounded-full outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${!dueDate ? 'text-transparent' : 'text-gray-600'}`}
                            />
                        </div>
                    </div>
                </div>

                {/* Priority Selection */}
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <BoltIcon className="h-3 w-3" /> Priority Level
                    </label>
                    <div className="flex gap-2">
                        <PriorityButton 
                            label="Low" 
                            value="Low" 
                            colorClass="bg-emerald-100 text-emerald-700 border-emerald-200" 
                            activeClass="ring-emerald-500"
                        />
                        <PriorityButton 
                            label="Medium" 
                            value="Medium" 
                            colorClass="bg-amber-100 text-amber-700 border-amber-200" 
                            activeClass="ring-amber-500"
                        />
                        <PriorityButton 
                            label="High" 
                            value="High" 
                            colorClass="bg-rose-100 text-rose-700 border-rose-200" 
                            activeClass="ring-rose-500"
                        />
                    </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Details <span className="text-gray-300 font-normal normal-case">(Optional)</span></label>
                  <textarea 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all placeholder-gray-400 min-h-[80px] text-sm"
                    placeholder="Add context..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
            </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          className={`w-full py-4 px-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-[0.98] flex justify-center items-center gap-2 
            ${loading 
                ? 'bg-gray-400 cursor-not-allowed shadow-none' 
                : mode === 'magic' 
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-200 hover:shadow-indigo-300' 
                    : 'bg-gray-800 hover:bg-gray-700 shadow-gray-200 hover:shadow-gray-300'
            }`}
        >
          {loading ? (
            <>
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{mode === 'magic' ? 'AI is Thinking...' : 'Saving...'}</span>
            </>
          ) : (
            mode === 'magic' ? (
                <>
                    <SparklesIcon className="h-5 w-5 text-indigo-100" />
                    <span>Auto-Analyze & Create</span>
                </>
            ) : (
                <>
                    <PlusCircleIcon className="h-5 w-5 text-gray-100" />
                    <span>Create Task</span>
                </>
            )
          )}
        </button>
      </form>
    </div>
  );
};

export default NewTaskForm;

import React, { useState, useEffect } from 'react';
import api from '../api';
import { SparklesIcon, PlusCircleIcon, CalendarDaysIcon } from '@heroicons/react/24/solid';

const NewTaskForm = ({ onTaskCreated, onClose }) => {
  // Helper to format date as YYYY-MM-DD
  const formatDate = (date) => date.toISOString().split('T')[0];

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

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [dueDate, setDueDate] = useState(getToday());
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const newTask = { title, description, priority, dueDate };
      const response = await api.post('/tasks', newTask);
      onTaskCreated(response.data);
      // Reset form
      setTitle('');
      setDescription('');
      setPriority('Medium');
      setDueDate(getToday());
      if (onClose) onClose();
    } catch (error) {
      console.error("Failed to create task", error);
    } finally {
      setLoading(false);
    }
  };

  const DateButton = ({ label, dateValue }) => (
    <button
      type="button"
      onClick={() => setDueDate(dateValue)}
      className={`px-3 py-1 text-xs font-medium border rounded-full transition-all hover:bg-gray-50 
        ${dueDate === dateValue 
            ? 'bg-blue-50 border-blue-500 text-blue-600 ring-2 ring-blue-500 ring-offset-1' 
            : 'border-gray-200 text-gray-600'}`}
    >
      {label}
    </button>
  );

  const PriorityButton = ({ label, value, colorClass, activeClass }) => (
    <button
      type="button"
      onClick={() => setPriority(value)}
      className={`px-3 py-1 text-xs font-bold border rounded-full transition-all hover:opacity-80
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
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 mb-6 animate-fade-in-down">
      <h2 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
        <div className="p-2 bg-indigo-100 rounded-lg">
            <PlusCircleIcon className="h-5 w-5 text-indigo-600" />
        </div>
        New Task
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Title Input */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Task Title</label>
          <input 
            type="text" 
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-gray-800 placeholder-gray-400 font-medium"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        {/* Quick Actions Row */}
        <div className="space-y-4">
            {/* Row 1: Deadlines */}
            <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Due Date</label>
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
                            className={`px-3 py-1 text-xs font-medium border rounded-full outline-none focus:ring-2 focus:ring-blue-500 transition-all ${!dueDate ? 'text-transparent' : 'text-gray-600'}`}
                        />
                        {!dueDate && <span className="absolute left-3 top-1 text-xs text-gray-400 pointer-events-none">Custom</span>}
                    </div>
                </div>
            </div>

            {/* Row 2: Priority */}
            <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Priority</label>
                <div className="flex gap-2">
                    <PriorityButton 
                        label="Low" 
                        value="Low" 
                        colorClass="bg-green-100 text-green-700 border-green-200" 
                        activeClass="ring-green-500"
                    />
                    <PriorityButton 
                        label="Medium" 
                        value="Medium" 
                        colorClass="bg-yellow-100 text-yellow-700 border-yellow-200" 
                        activeClass="ring-yellow-500"
                    />
                    <PriorityButton 
                        label="High" 
                        value="High" 
                        colorClass="bg-red-100 text-red-700 border-red-200" 
                        activeClass="ring-red-500"
                    />
                </div>
            </div>
        </div>
        
        {/* Description (Collapsible Detail) */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description <span className="text-gray-300 font-normal normal-case">(Optional)</span></label>
          <textarea 
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all placeholder-gray-400 min-h-[80px] text-sm"
            placeholder="Add details, context, or links..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className="text-[10px] text-indigo-400 mt-2 flex items-center gap-1.5 font-medium bg-indigo-50 w-fit px-2 py-1 rounded-md">
            <SparklesIcon className="h-3 w-3" />
            AI will analyze this to assign Energy Level
          </p>
        </div>

        {/* Submit Button */}
        <button 
          type="submit" 
          disabled={loading}
          className={`w-full py-3 px-4 rounded-xl font-bold text-white shadow-lg shadow-indigo-200 transition-all transform active:scale-[0.98] flex justify-center items-center gap-2 
            ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-300'}`}
        >
          {loading ? (
            <>
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
            </>
          ) : (
            'Create Task'
          )}
        </button>
      </form>
    </div>
  );
};

export default NewTaskForm;

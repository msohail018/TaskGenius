import React from 'react';
import TaskCard from './TaskCard';
import { PlusIcon } from '@heroicons/react/24/outline';

const Column = ({ title, tasks, status, onTaskUpdate, onTaskDelete }) => {
  const statusConfig = {
    'todo': {
      color: 'bg-rose-500',
      header: 'bg-gradient-to-b from-rose-50 to-rose-100 text-rose-800',
      border: 'border-rose-100'
    },
    'in-progress': {
      color: 'bg-amber-500',
      header: 'bg-gradient-to-b from-amber-50 to-amber-100 text-amber-800',
      border: 'border-amber-100'
    },
    'done': {
      color: 'bg-emerald-500',
      header: 'bg-gradient-to-b from-emerald-50 to-emerald-100 text-emerald-800',
      border: 'border-emerald-100'
    }
  };

  const config = statusConfig[status];

  return (
    <div className={`w-full md:w-[350px] md:flex-1 h-full flex flex-col rounded-3xl border border-white/50 bg-slate-100/50 backdrop-blur-sm shadow-inner overflow-hidden perspective-1000 transition-all duration-300`}>
      <div className={`p-5 ${config.header} flex justify-between items-center z-10 sticky top-0 border-b border-white/20 shadow-sm`}>
        <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg bg-white/60 shadow-sm ring-1 ring-black/5`}>
                <span className={`block h-3 w-3 rounded-full ${config.color}`}></span>
            </div>
            <h2 className={`font-bold text-sm uppercase tracking-wider`}>
                {title}
            </h2>
        </div>
        <span className="text-xs font-bold bg-white/60 px-3 py-1 rounded-full text-gray-600 shadow-sm ring-1 ring-black/5">{tasks.length}</span>
      </div>
      
      <div className="p-4 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
        {tasks.map(task => (
            <TaskCard 
                key={task._id} 
                task={task} 
                onUpdate={onTaskUpdate} 
                onDelete={onTaskDelete} 
            />
        ))}
        {tasks.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl m-2">
                <p className="text-gray-400 text-sm font-medium">No tasks yet</p>
                <p className="text-xs text-gray-300 mt-1">Ready for new challenges</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Column;

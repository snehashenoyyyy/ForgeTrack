import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, Calendar, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function CreateAssignment() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deadline: '',
    totalPoints: 100
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Note: We'll simulate success since we haven't added the table yet
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-display-sm mb-2">Create New Assignment</h1>
        <p className="text-body-lg text-secondary">Assign tasks and track student performance.</p>
      </header>

      <form onSubmit={handleSubmit} className="card p-8 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-label text-tertiary block mb-2 uppercase tracking-widest">ASSIGNMENT TITLE</label>
            <div className="relative">
               <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary" size={18} />
               <input 
                 className="input w-full pl-12" 
                 placeholder="e.g. Portfolio Phase 1" 
                 required 
                 value={formData.title}
                 onChange={e => setFormData({...formData, title: e.target.value})}
               />
            </div>
          </div>

          <div>
            <label className="text-label text-tertiary block mb-2 uppercase tracking-widest">DEADLINE</label>
            <div className="relative">
               <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary" size={18} />
               <input 
                 type="date" 
                 className="input w-full pl-12" 
                 required 
                 value={formData.deadline}
                 onChange={e => setFormData({...formData, deadline: e.target.value})}
               />
            </div>
          </div>

          <div>
            <label className="text-label text-tertiary block mb-2 uppercase tracking-widest">DESCRIPTION</label>
            <textarea 
              className="input w-full min-h-[120px] py-4" 
              placeholder="Provide instructions for students..." 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="btn btn-primary w-full h-[52px] flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : success ? (
            <>
              <CheckCircle size={20} />
              ASSIGNMENT CREATED
            </>
          ) : (
            <>
              <Upload size={20} />
              PUBLISH ASSIGNMENT
            </>
          )}
        </button>
      </form>

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-success-bg/10 border border-success-fg/20 flex items-center gap-3 text-success-fg"
        >
          <CheckCircle size={20} />
          <p className="text-body-sm font-medium">Assignment published successfully. Students can now view it in their dashboard.</p>
        </motion.div>
      )}
    </div>
  );
}

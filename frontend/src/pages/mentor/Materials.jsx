import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Monitor, PlayCircle, Code, FileText, ChevronRight, ExternalLink, Calendar, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function Materials() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form state
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('slides');
  const [url, setUrl] = useState('');

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          topic,
          date,
          materials(*)
        `)
        .order('date', { ascending: false });

      if (error) throw error;
      setSessions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    if (!supabase || !selectedSessionId || !title || !url) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('materials')
        .insert([{
          session_id: parseInt(selectedSessionId),
          title,
          type,
          url
        }]);

      if (error) throw error;
      
      // Reset form and refresh
      setTitle('');
      setUrl('');
      setShowAddModal(false);
      fetchMaterials();
    } catch (err) {
      console.error(err);
      alert('Error adding material');
    } finally {
      setSaving(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'slides': return <Monitor size={18} />;
      case 'recording': return <PlayCircle size={18} />;
      case 'code': return <Code size={18} />;
      default: return <FileText size={18} />;
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm mb-1">Study Materials</h1>
          <p className="text-body-sm text-secondary">Organize and share resources for each session</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add Material
        </button>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-surface-raised/30 rounded-2xl animate-pulse border border-subtle"></div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="p-20 text-center card border-dashed">
          <BookOpen size={48} className="mx-auto mb-4 opacity-10" />
          <p className="text-h3">No materials found</p>
          <p className="text-body-sm text-secondary">Start by adding a material to a session</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session, idx) => (
            <motion.div 
              key={session.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="card p-0 flex flex-col overflow-hidden group"
            >
              <div className="p-6 border-b border-subtle bg-surface-raised/50">
                <div className="flex items-center gap-2 mb-2 text-caption text-tertiary font-mono uppercase tracking-widest">
                  <Calendar size={14} />
                  {session.date}
                </div>
                <h3 className="text-h3 line-clamp-1">{session.topic}</h3>
              </div>

              <div className="flex-1 p-2">
                {session.materials.length === 0 ? (
                  <div className="p-8 text-center text-tertiary text-body-sm italic">
                    No materials linked yet
                  </div>
                ) : (
                  <div className="space-y-1">
                    {session.materials.map((mat) => (
                      <a 
                        key={mat.id}
                        href={mat.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-4 rounded-xl hover:bg-surface-raised transition-colors group/item"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-surface-inset text-secondary group-hover/item:text-primary transition-colors">
                            {getTypeIcon(mat.type)}
                          </div>
                          <div>
                            <p className="text-body-sm font-medium">{mat.title}</p>
                            <p className="text-micro text-tertiary uppercase">{mat.type}</p>
                          </div>
                        </div>
                        <ExternalLink size={14} className="text-tertiary opacity-0 group-hover/item:opacity-100 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Material Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="modal-overlay z-40"
            />
            <div className="modal-container">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="modal max-w-lg w-full"
              >
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-xl bg-accent-glow/10 text-accent-glow">
                  <Plus size={24} />
                </div>
                <div>
                  <h2 className="text-h2">Add Study Material</h2>
                  <p className="text-body-sm text-secondary">Link a resource to an existing session</p>
                </div>
              </div>

              <form onSubmit={handleAddMaterial} className="space-y-6">
                <div>
                  <label className="text-label text-tertiary block mb-2 uppercase">Target Session</label>
                  <select 
                    className="input w-full"
                    required
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                  >
                    <option value="">Select a session...</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>{s.date} - {s.topic}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-label text-tertiary block mb-2 uppercase">Material Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Session Slides, Project Repo" 
                    className="input w-full"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-label text-tertiary block mb-2 uppercase">Type</label>
                    <select 
                      className="input w-full"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="slides">Slides</option>
                      <option value="recording">Recording</option>
                      <option value="code">Source Code</option>
                      <option value="document">Document</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-label text-tertiary block mb-2 uppercase">URL / Link</label>
                  <input 
                    type="url" 
                    placeholder="https://..." 
                    className="input w-full"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary px-8">
                    {saving ? 'Adding...' : 'Add Resource'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}

import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, History, BookOpen, Upload, Settings, LogOut, CodeSquare, MessageSquare, Calendar, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar() {
  const { user, logout, role } = useAuth();
  
  const mentorLinks = [
    { label: 'Overview', items: [{ icon: LayoutDashboard, text: 'Dashboard', path: '/dashboard' }] },
    { label: 'Activity', items: [
      { icon: CheckSquare, text: 'Mark Attendance', path: '/attendance' },
      { icon: History, text: 'Attendance History', path: '/history' },
      { icon: MessageSquare, text: 'Review Appeals', path: '/appeals' },
      { icon: BookOpen, text: 'Materials', path: '/materials' },
      { icon: Upload, text: 'Create Assignment', path: '/create-assignment' }
    ]},
    { label: 'Data', items: [{ icon: Upload, text: 'Bulk AI Upload', path: '/bulk-upload' }] },
  ];

  const studentLinks = [
    { label: 'MY PORTAL', items: [
      { icon: LayoutDashboard, text: 'Overview', path: '/dashboard' },
      { icon: CheckSquare, text: 'My Attendance', path: '/dashboard' }, 
      { icon: Calendar, text: 'Upcoming', path: '/upcoming' },
      { icon: Upload, text: 'Assignments', path: '/assignments' },
      { icon: BookOpen, text: 'Materials', path: '/materials' },
      { icon: History, text: 'Results', path: '/results' },
      { icon: MessageSquare, text: 'Attendance Appeals', path: '/appeals' }
    ]},
  ];

  const links = role === 'student' ? studentLinks : mentorLinks;

  const userName = user?.name || user?.email?.split('@')[0] || 'User';

  return (
    <aside className="w-[260px] hidden md:flex flex-col border-r border-subtle bg-canvas shrink-0 h-screen sticky top-0 z-20">
      <div className="p-6 flex flex-col gap-4 border-b border-subtle">
        <div className="flex items-center gap-3">
          <div className="bg-accent-glow p-2 rounded-lg text-primary">
            <CodeSquare size={20} />
          </div>
          <span className="text-h2 font-display">ForgeTrack</span>
        </div>
        {role === 'student' && (
          <div className="inline-flex self-start px-3 py-1 rounded border-2 border-success-fg text-success-fg text-[10px] font-black tracking-widest uppercase">
            STUDENT
          </div>
        )}
      </div>

      {/* User profile section removed as requested */}

      
      {/* ... nav remains same ... */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {links.map((section, idx) => (
          <div key={idx}>
            <p className="text-label text-tertiary mb-3 px-2">{section.label}</p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-4 h-[44px] rounded-lg transition-all duration-200 group relative",
                    isActive 
                      ? "bg-surface-raised text-primary"
                      : "text-secondary hover:bg-surface hover:text-primary"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div 
                          layoutId="sidebar-active"
                          className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent-glow rounded-r-full" 
                        />
                      )}
                      <item.icon size={20} className="shrink-0" strokeWidth={1.75} />
                      <span className="text-body">{item.text}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-subtle space-y-2">
        <button 
          onClick={logout}
          className="flex items-center gap-3 px-4 h-[44px] rounded-lg text-secondary hover:bg-danger-bg hover:text-danger-fg transition-colors w-full group"
        >
          <LogOut size={20} strokeWidth={1.75} className="group-hover:scale-110 transition-transform" />
          <span className="text-body">Logout</span>
        </button>
        
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-inset">
          <div className={cn("w-2 h-2 rounded-full", supabase ? "bg-success-fg animate-pulse" : "bg-danger-fg")} />
          <span className="text-micro text-secondary font-mono tracking-wider">
            {supabase ? 'DB CONNECTED' : 'DB DISCONNECTED'}
          </span>
        </div>
      </div>
    </aside>
  );
}

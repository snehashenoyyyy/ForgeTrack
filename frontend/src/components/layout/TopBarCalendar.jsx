import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';

export default function TopBarCalendar() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sessionDates, setSessionDates] = useState(new Set());
  const navigate = useNavigate();
  const location = useLocation();

  // Close calendar when navigating to a new page
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isOpen) {
      fetchSessionDates();
    }
  }, [isOpen]);

  const fetchSessionDates = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('date')
        .order('date', { ascending: false });
      
      if (error) throw error;

      if (data && data.length > 0) {
        // Normalize dates to YYYY-MM-DD strings
        const dates = new Set(data.map(s => {
          const d = new Date(s.date);
          return d.toISOString().split('T')[0];
        }));
        
        setSessionDates(dates);
        console.log('Fetched Session Dates:', Array.from(dates));

        // Jump to the latest session's month
        const latest = new Date(data[0].date);
        setCurrentMonth(new Date(latest.getFullYear(), latest.getMonth(), 1));
      }
    } catch (err) {
      console.error('Error fetching session dates:', err);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const { firstDay, daysInMonth } = getDaysInMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  const onDateClick = (day) => {
    // Create date in local timezone
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    const formatted = localDate.toISOString().split('T')[0];
    
    navigate(`/attendance?date=${formatted}`);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="h-[36px] w-[36px] flex items-center justify-center rounded-lg border border-subtle bg-surface-raised hover:border-accent-glow/50 cursor-pointer transition-all"
      >
        <CalendarIcon size={16} className={cn("transition-colors", isOpen ? "text-accent-glow" : "text-secondary")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-[120%] left-0 w-[280px] bg-surface-raised border border-border-strong rounded-2xl shadow-2xl z-50 p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1 hover:bg-surface rounded-md"><ChevronLeft size={16}/></button>
                <span className="text-body-sm font-bold uppercase tracking-wider">
                  {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={nextMonth} className="p-1 hover:bg-surface rounded-md"><ChevronRight size={16}/></button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['S','M','T','W','T','F','S'].map(d => (
                  <span key={d} className="text-micro text-tertiary font-bold">{d}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {blanks.map(i => <div key={`b-${i}`} />)}
                {days.map(day => {
                  const dString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  
                  const hasSession = sessionDates.has(dString);
                  const isToday = dString === new Date().toISOString().split('T')[0];

                  return (
                    <button 
                      key={day}
                      onClick={() => onDateClick(day)}
                      className={cn(
                        "h-8 w-8 rounded-lg flex flex-col items-center justify-center relative text-body-sm transition-colors hover:bg-accent-glow/20",
                        isToday ? "bg-accent-glow/10 text-accent-glow font-bold" : "text-secondary"
                      )}
                    >
                      {day}
                      {hasSession && (
                        <span className="absolute bottom-1 w-2 h-2 rounded-full bg-[#FFD700] shadow-[0_0_8px_rgba(255,215,0,0.6)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import TopBarCalendar from './TopBarCalendar';

export default function TopBar({ breadcrumb = "Overview / Dashboard" }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      navigate(`/attendance?q=${encodeURIComponent(query)}`);
      setQuery('');
    }
  };

  return (
    <header className="h-[72px] px-8 flex items-center justify-between border-b border-subtle bg-canvas/50 backdrop-blur-md sticky top-0 z-10">
      <div className="text-body-sm text-secondary">
        {breadcrumb}
      </div>

      <div className="flex items-center gap-4">
        {/* Date Search (Custom Calendar with Yellow Dots) */}
        <TopBarCalendar />

        {/* Text Search */}
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
          <input 
            type="text" 
            placeholder="Search sessions..." 
            className="input h-[36px] text-body-sm w-[240px] input-with-icon"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-raised border border-default flex items-center justify-center text-body-sm font-medium">
            N
          </div>
        </div>
      </div>
    </header>
  );
}

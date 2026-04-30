import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Shell({ children }) {
  return (
    <div className="flex min-h-screen bg-void text-primary font-body">
      {!supabase && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-warning-bg border-b border-warning-border p-2 flex items-center justify-center gap-2 text-warning-fg text-micro font-bold">
          <AlertCircle size={14} />
          SUPABASE NOT CONNECTED. PLEASE CONFIGURE .ENV.LOCAL AND RESTART THE SERVER.
        </div>
      )}
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 app-main">
        <TopBar />
        <main className="flex-1 overflow-x-hidden pt-8 px-6 md:px-12 pb-24 max-w-[1440px] mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}

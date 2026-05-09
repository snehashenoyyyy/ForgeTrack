import React from 'react';
import { Construction } from 'lucide-react';

export default function ComingSoon({ title }) {
  return (
    <div className="h-[80vh] flex flex-col items-center justify-center text-center space-y-6">
      <div className="w-24 h-24 rounded-full bg-accent-glow/10 flex items-center justify-center text-accent-glow animate-bounce">
        <Construction size={48} />
      </div>
      <div>
        <h1 className="text-display-sm mb-2">{title}</h1>
        <p className="text-body-lg text-secondary max-w-md mx-auto">
          We're building this feature to help you track your progress better. Stay tuned for updates!
        </p>
      </div>
    </div>
  );
}

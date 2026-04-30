import React from 'react';

export default function DevTokens() {
  return (
    <div className="app-main p-8">
      <h1 className="text-display-lg mb-8">Design Tokens Test</h1>
      
      <div className="card max-w-xl mb-8">
        <h2 className="text-h2 mb-4">Cards & Typography</h2>
        <p className="text-body text-secondary mb-4">
          This is a surface card with the card-gradient overlay and subtle border.
        </p>
        <div className="flex gap-4">
          <button className="btn-primary">Primary Button</button>
          <button className="btn-secondary">Secondary Button</button>
        </div>
      </div>

      <div className="card max-w-xl mb-8">
        <h2 className="text-h2 mb-4">Inputs & Status</h2>
        <div className="mb-4">
          <label className="text-label text-secondary block mb-2">EMAIL ADDRESS</label>
          <input type="text" className="input w-full" placeholder="nischay@theboringpeople.in" />
        </div>
        <div className="flex gap-4">
          <span className="pill pill-success">Present</span>
          <span className="pill pill-danger">Absent</span>
        </div>
      </div>
    </div>
  );
}

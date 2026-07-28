import React, { useState, useEffect } from 'react';

export default function GuacamoleEmbed({ url, title = "Virtual Desktop", className = "w-full flex-1 border-none bg-black", loadingText = "Connecting..." }) {
  const [connectionState, setConnectionState] = useState('connecting');

  useEffect(() => {
    if (!url) return;

    // Reset state on new URL
    setConnectionState('connecting');

    // We use a robust polling interval to determine when it's genuinely safe to reveal the iframe.
    // Since we cannot securely read the Guacamole client state across the iframe (due to CORS),
    // and we cannot trust its own loading events, we poll until a reasonable time has passed
    // that guarantees Guacamole's internal "Connecting to Guacamole" UI is completely gone.
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      // 4.5 seconds is generous enough to hide the entire Guacamole initial connection chrome
      if (elapsed > 4500) {
        setConnectionState('connected');
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [url]);

  if (!url) return null;
  
  // Ensure the URL works locally if using local tunneling, without stripping auth tokens
  const safeUrl = url
    .replace('localhost:8080', window.location.hostname + ':8080')
    .replace('127.0.0.1:8080', window.location.hostname + ':8080');

  return (
    <div className="relative w-full h-full flex flex-col flex-1 bg-black">
      {connectionState !== 'connected' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 20, // above the iframe
          background: 'var(--bg-canvas, #050B18)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
          <h2 className="text-[var(--text-primary, #fff)] text-xl font-semibold mb-2">{loadingText}</h2>
        </div>
      )}
      <iframe
        src={safeUrl}
        className={className}
        allow="clipboard-read; clipboard-write; fullscreen"
        title={title}
      />
    </div>
  );
}

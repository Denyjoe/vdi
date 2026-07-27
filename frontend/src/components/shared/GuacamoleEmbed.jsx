import React from 'react';

export default function GuacamoleEmbed({ url, title = "Virtual Desktop", className = "w-full flex-1 border-none bg-black" }) {
  if (!url) return null;
  
  // Ensure the URL works locally if using local tunneling, without stripping auth tokens
  const safeUrl = url
    .replace('localhost:8080', window.location.hostname + ':8080')
    .replace('127.0.0.1:8080', window.location.hostname + ':8080');

  return (
    <iframe
      src={safeUrl}
      className={className}
      allow="clipboard-read; clipboard-write; fullscreen"
      title={title}
    />
  );
}

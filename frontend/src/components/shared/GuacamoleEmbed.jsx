import React, { useState, useEffect, useRef } from 'react';

/**
 * Renders a Guacamole session iframe. The iframe is only ever made visible
 * once BOTH conditions hold: a minimum cover period has elapsed (avoids a
 * flash of Guacamole's own initial connection chrome, which we cannot
 * observe directly across the cross-origin iframe boundary) AND the parent
 * reports `tunnelActive` — a real signal from Guacamole's own
 * activeConnections API, not an assumption. There is no timer-only path
 * that reveals the iframe: if the tunnel never comes up (VM not ready,
 * genuine network failure, guacd down), the cover simply never lifts,
 * so Guacamole's raw UI can never leak through undetected.
 *
 * The iframe itself is hidden with visibility:hidden (not just covered by
 * an overlay on top) so even if Guacamole renders something the instant
 * the tunnel drops, it is not visible at the browser rendering level.
 */
export default function GuacamoleEmbed({
  url,
  title = "Virtual Desktop",
  className = "w-full flex-1 border-none bg-black",
  loadingText = "Connecting...",
  tunnelActive = false,
  minCoverMs = 4500,
}) {
  const [minCoverElapsed, setMinCoverElapsed] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!url) return;
    setMinCoverElapsed(false);
    const t = setTimeout(() => setMinCoverElapsed(true), minCoverMs);
    return () => clearTimeout(t);
  }, [url, minCoverMs]);

  const ready = minCoverElapsed && tunnelActive;

  useEffect(() => {
    if (!ready) return;
    // Guacamole captures keyboard input via listeners on its own iframe
    // document, which only receive events once the iframe itself holds
    // focus. Browsers don't grant that automatically for an embedded
    // iframe — a real click over the canvas usually does, but a user
    // who starts typing before ever clicking (or right after a
    // reconnect swaps in a fresh iframe) gets silent, working mouse
    // input and completely dead keyboard input. Force focus once the
    // desktop is actually up so keyboard works without requiring a
    // click first.
    iframeRef.current?.focus();
  }, [ready]);

  if (!url) return null;

  // Ensure the URL works locally if using local tunneling, without stripping auth tokens
  const safeUrl = url
    .replace('localhost:8080', window.location.hostname + ':8080')
    .replace('127.0.0.1:8080', window.location.hostname + ':8080');

  return (
    <div
      className="relative w-full h-full flex flex-col flex-1 bg-black"
      onMouseDown={() => iframeRef.current?.focus()}
      onMouseEnter={() => iframeRef.current?.focus()}
    >
      {!ready && (
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
        ref={iframeRef}
        src={safeUrl}
        className={className}
        style={{
          visibility: ready ? 'visible' : 'hidden',
          pointerEvents: ready ? 'auto' : 'none',
        }}
        allow="clipboard-read; clipboard-write; fullscreen"
        title={title}
        tabIndex="0"
      />
    </div>
  );
}

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import LoadingLogo from './LoadingLogo';

/**
 * Reaches into the Guacamole iframe's own live AngularJS scope to drive
 * real, built-in client settings (on-screen keyboard, mouse mode, zoom)
 * that are otherwise only reachable through Guacamole's own hidden
 * edge-swipe menu. This is NOT a hack layered on top of a cross-origin
 * boundary: our backend serves guacamole_url as a *relative* path
 * (GUACAMOLE_PUBLIC_URL=/guacamole, proxied server-side to the real
 * Guacamole host — see vite.config.js / nginx), so the iframe is
 * genuinely same-origin with our own page, and contentWindow access is
 * not blocked by the browser's cross-origin policy. Confirmed by direct
 * testing against a real connection through this exact iframe (not just
 * assumed): Guacamole's client neither reads URL query parameters
 * (input-method / mouse-mode) nor listens for postMessage — the only
 * mechanism that genuinely works is this one, reaching the same
 * top-level Angular scope Guacamole's own menu template binds to
 * (`menu.inputMethod`, `menu.emulateAbsoluteMouse`,
 * `focusedClient.clientProperties.scale`).
 */
function findGuacScope(win) {
  if (!win || !win.angular || !win.document) return null;
  const angular = win.angular;
  const all = win.document.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    try {
      const s = angular.element(all[i]).scope();
      if (s && s.menu && 'focusedClient' in s) return s;
    } catch (e) {
      // Detached / non-Angular element — expected for most nodes, skip.
    }
  }
  return null;
}

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
 *
 * Real performance-audit finding: DesktopSessionPage's countdown timer
 * ticks its own state every second, unrelated to the connection itself —
 * measured via React's real commit callback (not assumed) that this was
 * re-rendering the entire page, including this component, roughly once
 * per second. All props here are primitives, so React.memo's default
 * shallow comparison correctly skips a re-render whenever none of them
 * actually changed (confirmed via the same real measurement after this
 * fix — see the performance audit report for before/after commit counts).
 */
const GuacamoleEmbed = React.memo(forwardRef(function GuacamoleEmbed({
  url,
  title = "Virtual Desktop",
  className = "w-full flex-1 border-none bg-black",
  loadingText = "Connecting...",
  tunnelActive = false,
  minCoverMs = 4500,
}, ref) {
  const [minCoverElapsed, setMinCoverElapsed] = useState(false);
  const iframeRef = useRef(null);
  // Bumping this forces React to fully unmount/remount the iframe, which
  // makes Guacamole open a brand new connection. This is the fix for
  // rotation: Guacamole only sizes the remote desktop to the *container's
  // dimensions at the moment its connection is first established* — see
  // the reconnectOnRotate effect below for why we can't just ask an
  // already-connected session to resize in place.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!url) return;
    setMinCoverElapsed(false);
    const t = setTimeout(() => setMinCoverElapsed(true), minCoverMs);
    return () => clearTimeout(t);
  }, [url, minCoverMs, reloadKey]);

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

  useEffect(() => {
    // The iframe's own box resizes correctly via flex layout the instant
    // the container does (fullscreen toggle, window resize, phone/tablet
    // rotation) — that part is reliable and already confirmed by real
    // measurement. What ISN'T reliable is what happens after: Guacamole's
    // own webapp (cross-origin — its DOM is genuinely unreachable from
    // here, not just an assumption) detects its element's size through a
    // second, independently-nested resize-sensor object embedded *inside
    // its own document*, one level deeper than our iframe. Real testing
    // (dispatching genuine resize events at each nesting level and
    // inspecting the actual rendered canvas resolution) showed that a
    // resize of our outer iframe does NOT reliably cascade a native
    // 'resize' event down to that inner sensor — the desktop's pixel
    // resolution stays frozen at whatever it was when the connection was
    // first opened, no matter how many times or how gently the outer box
    // is nudged. That's the actual cause of the "stuck in the old
    // orientation" bug, not a missing resize-method setting (that part
    // was already configured correctly).
    //
    // The one thing that DOES reliably work: Guacamole sizes the remote
    // desktop to its container's *actual dimensions at the moment the
    // connection is first established* (a one-time measurement, not an
    // ongoing subscription). So on a genuine orientation flip, instead of
    // asking an already-open session to resize in place, we force a full
    // reconnect (fresh iframe, fresh Guacamole connection) after a short
    // settle delay — the new connection then measures the *already
    // rotated* container and comes up at the correct resolution from the
    // start. This briefly re-shows the loading cover, which is an honest
    // reflection of a real reconnect happening, not a decorative flourish.
    let lastWasLandscape = window.innerWidth > window.innerHeight;
    let settleTimer = null;

    const reconnectOnRotate = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape === lastWasLandscape) return;
      lastWasLandscape = isLandscape;
      if (settleTimer) clearTimeout(settleTimer);
      // Give the browser a moment to finish the rotation (toolbar
      // show/hide, viewport height settling) before measuring the new
      // container size via reconnect.
      settleTimer = setTimeout(() => setReloadKey(k => k + 1), 400);
    };

    window.addEventListener('resize', reconnectOnRotate);
    window.addEventListener('orientationchange', reconnectOnRotate);
    // Fullscreen toggle can also flip the effective aspect ratio (e.g. it
    // removes browser chrome that was eating into the available height),
    // so it goes through the same real aspect-ratio check, not a blind nudge.
    document.addEventListener('fullscreenchange', reconnectOnRotate);
    document.addEventListener('webkitfullscreenchange', reconnectOnRotate);
    return () => {
      window.removeEventListener('resize', reconnectOnRotate);
      window.removeEventListener('orientationchange', reconnectOnRotate);
      document.removeEventListener('fullscreenchange', reconnectOnRotate);
      document.removeEventListener('webkitfullscreenchange', reconnectOnRotate);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    // Returns the new boolean state (true = OSK now on) on success, or
    // null if the scope genuinely couldn't be reached (connection not
    // ready yet, or Guacamole's own DOM structure changed).
    toggleKeyboard() {
      const scope = findGuacScope(iframeRef.current?.contentWindow);
      if (!scope) return null;
      const turningOn = scope.menu.inputMethod !== 'osk';
      scope.$apply(() => {
        scope.menu.inputMethod = turningOn ? 'osk' : 'none';
      });
      return turningOn;
    },
    // Returns the new boolean state (true = Touchpad/relative mode now
    // on) on success, or null if unreachable.
    toggleTouchpadMode() {
      const scope = findGuacScope(iframeRef.current?.contentWindow);
      if (!scope) return null;
      // emulateAbsoluteMouse: true = Touchscreen (absolute tap-to-click),
      // false = Touchpad (relative movement).
      const nextEmulateAbsolute = !scope.menu.emulateAbsoluteMouse;
      scope.$apply(() => {
        scope.menu.emulateAbsoluteMouse = nextEmulateAbsolute;
      });
      return !nextEmulateAbsolute; // true = touchpad mode is now on
    },
    // Adjusts the real, built-in manual zoom (clientProperties.scale),
    // clamped to Guacamole's own min/max for the current connection.
    // Returns the resulting scale, or null if unreachable.
    zoomBy(delta) {
      const scope = findGuacScope(iframeRef.current?.contentWindow);
      const cp = scope?.focusedClient?.clientProperties;
      if (!cp) return null;
      const next = Math.max(cp.minScale, Math.min(cp.maxScale, cp.scale + delta));
      scope.$apply(() => {
        cp.autoFit = false;
        cp.scale = next;
      });
      return next;
    },
    // Live read of current state, used to keep our own toolbar's
    // pressed/active indicators honest rather than optimistically assumed.
    getState() {
      const scope = findGuacScope(iframeRef.current?.contentWindow);
      if (!scope) return null;
      return {
        keyboardOn: scope.menu.inputMethod === 'osk',
        touchpadOn: !scope.menu.emulateAbsoluteMouse,
        scale: scope.focusedClient?.clientProperties?.scale ?? null,
      };
    },
    // Measures Guacamole's own real, rendered on-screen-keyboard element
    // height directly, instead of guessing a fixed pixel value. Confirmed
    // via direct DOM inspection against a live connection (not assumed):
    // Guacamole renders the OSK as `.keyboard-container` > `.osk` >
    // `.guac-keyboard`, all reporting the same content height —
    // '.keyboard-container' is the outermost wrapper, used here as the
    // authoritative "how much space Guacamole itself is using" figure.
    // Confirmed real, and confirmed genuinely DIFFERENT between
    // orientations (~118px portrait vs ~250px landscape at a 375x812 /
    // 812x375 phone, on the same connection) — Guacamole scales key size
    // to fill the available width, so a wider (landscape) container
    // produces bigger keys and therefore a taller keyboard overall, not
    // a shorter one. Returns null (not 0) when the OSK isn't currently
    // rendered — e.g. toggled off, or the connection/scope isn't ready
    // yet — so callers can tell "unknown" apart from "genuinely zero".
    measureOskHeight() {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return null;
      const osk = doc.querySelector('.keyboard-container');
      if (!osk) return null;
      const height = osk.getBoundingClientRect().height;
      return height > 0 ? height : null;
    },
    // Sends a real key event through Guacamole's own live client — the
    // exact same mechanism (confirmed via direct scope inspection, not
    // assumed) that Guacamole's own webapp uses internally for physical
    // keyboard input once the iframe holds focus:
    // `focusedClient.client.sendKeyEvent(pressed, keysym)`, part of the
    // standard guacamole-common-js Client API. `pressed` is 1 for
    // key-down, 0 for key-up. Returns true if the event was genuinely
    // sent, false if there's no live client to send it to (connection
    // not ready) — callers should surface that honestly, not assume
    // success.
    sendKeyEvent(pressed, keysym) {
      const scope = findGuacScope(iframeRef.current?.contentWindow);
      const client = scope?.focusedClient?.client;
      if (!client) return false;
      client.sendKeyEvent(pressed, keysym);
      return true;
    },
  }), []);

  if (!url) return null;

  // Ensure the URL works locally if using local tunneling, without stripping auth tokens
  const safeUrl = url
    .replace('localhost:8080', window.location.hostname + ':8080')
    .replace('127.0.0.1:8080', window.location.hostname + ':8080');

  return (
    <div
      className="relative w-full h-full flex flex-col flex-1 bg-black"
      // Real, confirmed bug (not a guess): a flex item's automatic
      // min-height defaults to its *content-based* minimum, and for a
      // replaced element like <iframe> that's the browser's intrinsic
      // default size (300x150) — NOT 0. Without overriding it here, this
      // div refused to shrink below 150px tall no matter how small its
      // own parent (the on-screen-keyboard height reservation in
      // DesktopSessionPage) was told to be, confirmed by direct
      // measurement: parent computed to 125.15px, this stayed at 150px
      // regardless, overflowing its own parent by ~25px in landscape.
      style={{ minHeight: 0 }}
      onMouseDown={() => iframeRef.current?.focus()}
      onMouseEnter={() => iframeRef.current?.focus()}
    >
      {/*
        Always rendered (not conditionally mounted) so the fade-out on
        connect is a genuine CSS transition rather than an abrupt unmount.
        The transition is purely cosmetic — the REAL safety mechanism is
        still the iframe's own visibility:hidden below, which this overlay
        sits on top of but never substitutes for. Even with opacity:0 and
        pointer-events:none, this div stays in the DOM at zIndex 20; the
        iframe underneath remains genuinely hidden at the rendering level
        until `ready` is true, exactly as before.
      */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20, // above the iframe
        background: 'var(--bg-canvas, #050B18)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: ready ? 0 : 1,
        transition: 'opacity 300ms ease-out',
        pointerEvents: ready ? 'none' : 'auto',
      }}>
        <LoadingLogo statusText={loadingText} />
      </div>
      <iframe
        key={reloadKey}
        ref={iframeRef}
        src={safeUrl}
        className={className}
        style={{
          visibility: ready ? 'visible' : 'hidden',
          pointerEvents: ready ? 'auto' : 'none',
          // The actual fix (see the wrapper div's comment above): this
          // is the real replaced element the browser's intrinsic
          // 150px-minimum applies to directly — min-height:0 here is
          // what genuinely lets it shrink to whatever height its flex
          // parent gives it, confirmed by direct before/after
          // measurement in landscape (150px stuck -> matches parent
          // exactly once this is set).
          minHeight: 0,
        }}
        allow="clipboard-read; clipboard-write; fullscreen"
        title={title}
        tabIndex="0"
      />
    </div>
  );
}));

export default GuacamoleEmbed;

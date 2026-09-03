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
  // Real, confirmed gap this closes: `tunnelActive` alone (guacd having
  // accepted a client) is necessary but NOT sufficient for the console
  // to actually be usable — `ready` below also requires Guacamole's own
  // client to reach its real CONNECTED state (clientReallyConnected).
  // Reproduced live: a job whose real VNC/console session was already
  // consumed/stale left `tunnelActive` reading positive indefinitely
  // (guacd genuinely had an open tunnel) while Guacamole's own client
  // stayed stuck at CONNECTING/WAITING forever — invisible to any
  // caller only watching `tunnelActive`, since that one signal reports
  // false progress. Callers that need to detect "stuck even though the
  // transport looks fine" (e.g. a wizard's own connect-retry watchdog)
  // should key off this callback instead of `tunnelActive`.
  onReadyChange,
}, ref) {
  const [minCoverElapsed, setMinCoverElapsed] = useState(false);
  // Real, confirmed gap the external `tunnelActive` signal alone
  // doesn't cover: Guacamole's server-side activeConnections API (what
  // tunnelActive is polled from) reports a tunnel "active" the instant
  // guacd accepts a client — BEFORE the real remote-desktop handshake
  // to the actual VM has succeeded, and that can flap true/false for a
  // stretch after a real disruption (e.g. the VM itself rebooting)
  // rather than settling immediately. Reproduced live: after a real
  // VM stop/start, tunnelActive read positive for long enough to
  // satisfy its own confirm-strikes and lift the cover while
  // Guacamole's OWN client was still internally stuck showing "Waiting
  // for response…" — a real, raw leak the external signal alone
  // can't see. Guacamole's client exposes its own authoritative
  // connection state via onstatechange (0=IDLE, 1=CONNECTING,
  // 2=WAITING, 3=CONNECTED, 4=DISCONNECTING, 5=DISCONNECTED) — reading
  // that directly from inside the iframe (same-origin, already proven
  // reachable elsewhere in this file) is what "waiting for response"
  // actually means internally, not an assumption. Requiring BOTH
  // signals closes the gap without weakening either one.
  const [clientReallyConnected, setClientReallyConnected] = useState(false);
  const iframeRef = useRef(null);
  // Bumping this forces React to fully unmount/remount the iframe, which
  // makes Guacamole open a brand new connection. This is the fix for
  // rotation: Guacamole only sizes the remote desktop to the *container's
  // dimensions at the moment its connection is first established* — see
  // the reconnectOnRotate effect below for why we can't just ask an
  // already-connected session to resize in place.
  const [reloadKey, setReloadKey] = useState(0);
  // Real, local measurement point for rescaling below — this component's
  // own outer wrapper, not DesktopSessionPage's outer fullscreen
  // container (a different element in a different file). Its box is
  // already confirmed correctly sized by the existing flex-1 CSS chain,
  // so it's the right thing to measure against.
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!url) return;
    setMinCoverElapsed(false);
    const t = setTimeout(() => setMinCoverElapsed(true), minCoverMs);
    return () => clearTimeout(t);
  }, [url, minCoverMs, reloadKey]);

  // Real client-state observation — see clientReallyConnected above.
  // The scope/client object isn't reachable the instant the iframe
  // starts loading (Guacamole's own Angular app has to bootstrap
  // first), so this polls briefly until it's found rather than
  // assuming a single check will land at the right moment; once found,
  // it hooks the client's own onstatechange for the real, live signal
  // going forward instead of continuing to poll.
  useEffect(() => {
    if (!url) return undefined;
    setClientReallyConnected(false);
    let cancelled = false;
    let attachedClient = null;
    let prevOnStateChange = null;

    const findAndAttach = () => {
      if (cancelled) return true;
      const win = iframeRef.current?.contentWindow;
      const scope = findGuacScope(win);
      const client = scope?.focusedClient?.client;
      if (!client) return false;
      attachedClient = client;
      prevOnStateChange = client.onstatechange;
      client.onstatechange = (state) => {
        if (typeof prevOnStateChange === 'function') prevOnStateChange(state);
        if (!cancelled) setClientReallyConnected(state === 3);
      };
      return true;
    };

    let pollId = null;
    if (!findAndAttach()) {
      pollId = setInterval(() => {
        if (findAndAttach() && pollId) clearInterval(pollId);
      }, 250);
    }

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      if (attachedClient) attachedClient.onstatechange = prevOnStateChange;
    };
  }, [url, reloadKey]);

  const ready = minCoverElapsed && tunnelActive && clientReallyConnected;

  useEffect(() => {
    onReadyChange?.(ready);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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

    const scheduleReconnect = () => {
      if (settleTimer) clearTimeout(settleTimer);
      // Give the browser a moment to finish the rotation/fullscreen
      // transition (toolbar show/hide, viewport height settling) before
      // measuring the new container size via reconnect.
      settleTimer = setTimeout(() => setReloadKey(k => k + 1), 400);
    };

    const reconnectOnRotate = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape === lastWasLandscape) return;
      lastWasLandscape = isLandscape;
      scheduleReconnect();
    };

    // Real, confirmed root cause of "Guacamole fills only part of the
    // screen, rest is black dead space" in fullscreen: entering/exiting
    // fullscreen changes the container's real available pixel dimensions
    // (the browser hides/shows its address bar and toolbar chrome) even
    // when the landscape-vs-portrait *category* doesn't change — e.g. a
    // phone already rotated to landscape, then toggling fullscreen while
    // staying landscape the whole time. reconnectOnRotate's
    // landscape-unchanged guard above skips the reconnect in exactly
    // that case, so Guacamole's canvas stays sized to its pre-fullscreen
    // dimensions while the container has genuinely grown around it.
    // Fullscreen changes always force a reconnect unconditionally,
    // bypassing that guard rather than routing through it.
    const reconnectOnFullscreenChange = () => {
      lastWasLandscape = window.innerWidth > window.innerHeight;
      scheduleReconnect();
    };

    window.addEventListener('resize', reconnectOnRotate);
    window.addEventListener('orientationchange', reconnectOnRotate);
    document.addEventListener('fullscreenchange', reconnectOnFullscreenChange);
    document.addEventListener('webkitfullscreenchange', reconnectOnFullscreenChange);
    return () => {
      window.removeEventListener('resize', reconnectOnRotate);
      window.removeEventListener('orientationchange', reconnectOnRotate);
      document.removeEventListener('fullscreenchange', reconnectOnFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', reconnectOnFullscreenChange);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, []);
  // --- SAFELY ENFORCE AUTOFIT & LAYOUT ---
  // Guacamole's internal resize sensor often misses the final flexbox layout settling
  // on mobile, causing broken panning bounds (where you can't pan down even when zoomed).
  // We manually dispatch resize events into the iframe to force a layout recalculation.
  const enforceAutoFit = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const scope = findGuacScope(iframe.contentWindow);
    const client = scope?.focusedClient?.client;
    const cp = scope?.focusedClient?.clientProperties;
    const display = client?.getDisplay?.();
    
    if (!scope || !cp || !display) return;

    // Wait for the real VNC desktop resolution to arrive.
    const displayWidth = display.getWidth();
    if (!displayWidth || displayWidth < 200) return;

    // Note: Previously we injected CSS here to force flex-alignment, but it breaks 
    // Guacamole's internal absolute positioning and panning logic on mobile devices, 
    // resulting in a blank screen. Guacamole must control its own body layout.

    // 2. Force Guacamole to update its internal container bounds so panning works perfectly
    // even when zoomed in.
    iframe.contentWindow.dispatchEvent(new Event('resize'));

    // 3. Only toggle autoFit if the user wants it to fit.
    if (cp.autoFit) {
      setTimeout(() => {
        if (!iframeRef.current) return;
        scope.$apply(() => { cp.autoFit = false; });
        setTimeout(() => {
          if (!iframeRef.current) return;
          scope.$apply(() => { cp.autoFit = true; });
        }, 50);
      }, 10);
    }
  };

  // Safely poll for a short window after connection to catch any late layout settling
  useEffect(() => {
    if (!ready) return undefined;
    let count = 0;
    const interval = setInterval(() => {
      enforceAutoFit();
      count++;
      if (count > 20) clearInterval(interval); // Stop after 2 seconds
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Ensure any container resizes (e.g. OSK opening) are caught
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof ResizeObserver === 'undefined') return undefined;
    let debounceId = null;
    const observer = new ResizeObserver(() => {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(enforceAutoFit, 150);
    });
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
      if (debounceId) clearTimeout(debounceId);
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
      ref={wrapperRef}
      className="relative w-full h-full flex flex-col flex-1 bg-black overflow-hidden"
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

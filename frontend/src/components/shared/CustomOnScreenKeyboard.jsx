import { useState, useCallback, useEffect, useRef } from 'react';
import { X, GripHorizontal, Delete, CornerDownLeft, ArrowUp, ArrowLeft, ArrowRight, ArrowDown } from 'lucide-react';

/**
 * CustomOnScreenKeyboard
 *
 * A genuinely complete, floating, freely-resizable on-screen keyboard —
 * full function row, full number/symbol row, full letter rows,
 * navigation cluster, arrow cluster, modifier keys — styled after
 * Windows' On-Screen Keyboard. Sends real key events through the SAME
 * mechanism Guacamole's own webapp uses internally for physical
 * keyboard input: `Guacamole.Client.sendKeyEvent(pressed, keysym)`,
 * reached via GuacamoleEmbed's `sendKeyEvent` imperative-handle method
 * (findGuacScope -> focusedClient.client.sendKeyEvent).
 *
 * Every non-printable keysym below is cross-checked against Guacamole's
 * own real, shipped client library (guacamole-common-js's keysym name
 * table, fetched directly from the live app) — not guessed from memory
 * alone. Printable characters (letters, digits, symbols) need no
 * lookup table: X11 keysyms for the printable Latin-1 range map 1:1 to
 * Unicode code points, confirmed against that same real source, so
 * `char.charCodeAt(0)` is correct for any of them directly.
 */
const KEYSYM = {
  ESCAPE: 65307,        // 0xFF1B
  F1: 65470, F2: 65471, F3: 65472, F4: 65473, F5: 65474, F6: 65475,
  F7: 65476, F8: 65477, F9: 65478, F10: 65479, F11: 65480, F12: 65481,
  BACKSPACE: 65288,     // 0xFF08
  TAB: 65289,           // 0xFF09
  CAPS_LOCK: 65509,     // 0xFFE5
  ENTER: 65293,         // 0xFF0D
  SHIFT_L: 65505,       // 0xFFE1
  SHIFT_R: 65506,       // 0xFFE2
  CONTROL_L: 65507,     // 0xFFE3
  CONTROL_R: 65508,     // 0xFFE4
  ALT_L: 65513,         // 0xFFE9
  ALT_R: 65514,         // 0xFFEA
  SUPER_L: 65515,       // 0xFFEB — the "Win" key
  SPACE: 32,
  INSERT: 65379,        // 0xFF63
  DELETE: 65535,        // 0xFFFF
  HOME: 65360,          // 0xFF50
  END: 65367,           // 0xFF57
  PAGE_UP: 65365,       // 0xFF55
  PAGE_DOWN: 65366,     // 0xFF56
  ARROW_UP: 65362,      // 0xFF52
  ARROW_DOWN: 65364,    // 0xFF54
  ARROW_LEFT: 65361,    // 0xFF51
  ARROW_RIGHT: 65363,   // 0xFF53
};

// [normal, shifted] pairs — standard US QWERTY, full rows including the
// keys a compact layout usually drops ( \ | and the full punctuation set).
const FUNCTION_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
const NUMBER_ROW = [['`', '~'], ['1', '!'], ['2', '@'], ['3', '#'], ['4', '$'], ['5', '%'], ['6', '^'], ['7', '&'], ['8', '*'], ['9', '('], ['0', ')'], ['-', '_'], ['=', '+']];
const TOP_ROW = [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R'], ['t', 'T'], ['y', 'Y'], ['u', 'U'], ['i', 'I'], ['o', 'O'], ['p', 'P'], ['[', '{'], [']', '}'], ['\\', '|']];
const HOME_ROW = [['a', 'A'], ['s', 'S'], ['d', 'D'], ['f', 'F'], ['g', 'G'], ['h', 'H'], ['j', 'J'], ['k', 'K'], ['l', 'L'], [';', ':'], ["'", '"']];
const BOTTOM_ROW = [['z', 'Z'], ['x', 'X'], ['c', 'C'], ['v', 'V'], ['b', 'B'], ['n', 'N'], ['m', 'M'], [',', '<'], ['.', '>'], ['/', '?']];

const MIN_WIDTH = 520;
const MIN_HEIGHT = 260;
const DEFAULT_WIDTH = 700;
const DEFAULT_HEIGHT = 320;
const TITLE_BAR_HEIGHT = 34;
const HANDLE_SIZE = 10;

function clampBounds() {
  return {
    maxW: Math.max(MIN_WIDTH, window.innerWidth - 16),
    maxH: Math.max(MIN_HEIGHT, window.innerHeight - 16),
  };
}

export default function CustomOnScreenKeyboard({ onKeyEvent, onDismiss }) {
  const [size, setSize] = useState(() => {
    const { maxW, maxH } = clampBounds();
    return { width: Math.min(DEFAULT_WIDTH, maxW), height: Math.min(DEFAULT_HEIGHT, maxH) };
  });
  const [pos, setPos] = useState(() => ({
    x: Math.max(8, Math.round((window.innerWidth - Math.min(DEFAULT_WIDTH, window.innerWidth - 16)) / 2)),
    y: Math.max(8, window.innerHeight - Math.min(DEFAULT_HEIGHT, window.innerHeight - 16) - 16),
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [shiftOn, setShiftOn] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [held, setHeld] = useState({}); // { [keysym]: true } for genuinely held modifiers (Ctrl/Alt/Win)
  const [pressedKey, setPressedKey] = useState(null);
  const pressedTimerRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  useEffect(() => () => { if (pressedTimerRef.current) clearTimeout(pressedTimerRef.current); }, []);

  const flash = useCallback((label) => {
    setPressedKey(label);
    if (pressedTimerRef.current) clearTimeout(pressedTimerRef.current);
    pressedTimerRef.current = setTimeout(() => setPressedKey(null), 120);
  }, []);

  const tapKeysym = useCallback((keysym) => {
    onKeyEvent(1, keysym);
    onKeyEvent(0, keysym);
  }, [onKeyEvent]);

  // effectiveShift XORs Shift with Caps Lock, exactly like a real
  // keyboard — holding Shift while Caps Lock is on produces lowercase.
  const effectiveShift = shiftOn !== capsOn;

  const handleCharKey = (pair) => {
    const char = effectiveShift ? pair[1] : pair[0];
    tapKeysym(char.charCodeAt(0));
    flash(char);
    // Shift affects only the next keystroke, then auto-reverts (see
    // CustomOnScreenKeyboard's original design note: X11 keysyms for
    // printable characters already encode case/shift-state directly,
    // so this is correct without ever holding a real Shift_L/R key at
    // the protocol level). Caps Lock is a separate, persistent toggle.
    if (shiftOn) setShiftOn(false);
  };

  const handleSpecialKey = (keysym, label) => {
    tapKeysym(keysym);
    flash(label);
  };

  // Ctrl/Alt/Win are genuinely different from Shift/Caps: a remote
  // application checks whether they're HELD DOWN during another
  // keypress (e.g. Ctrl+C, Alt+Tab, Win+D), not a different character
  // code — so these are real sticky modifiers: press-only when turned
  // on, release-only when turned off. Each physical key (including the
  // separate left/right Ctrl and Alt) tracks its own held state
  // independently, matching real keyboard behavior.
  const toggleHeld = (keysym) => {
    setHeld(prev => {
      const next = { ...prev };
      if (next[keysym]) {
        delete next[keysym];
        onKeyEvent(0, keysym);
      } else {
        next[keysym] = true;
        onKeyEvent(1, keysym);
      }
      return next;
    });
  };

  // ---- Drag (title bar) ----
  const handleDragStart = (e) => {
    const touch = e.touches?.[0] || e;
    dragRef.current = { startX: touch.clientX, startY: touch.clientY, posX: pos.x, posY: pos.y };
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e) => {
      const r = dragRef.current;
      if (!r) return;
      const touch = e.touches?.[0] || e;
      const dx = touch.clientX - r.startX;
      const dy = touch.clientY - r.startY;
      // Never let it go fully off-screen — the title bar (at least
      // 60px of it) must always stay reachable to drag back.
      const x = Math.max(-(size.width - 60), Math.min(r.posX + dx, window.innerWidth - 60));
      const y = Math.max(0, Math.min(r.posY + dy, window.innerHeight - TITLE_BAR_HEIGHT));
      setPos({ x, y });
    };
    const handleEnd = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, size.width]);

  // ---- Resize (all 4 edges + all 4 corners) ----
  const handleResizeStart = (handle) => (e) => {
    const touch = e.touches?.[0] || e;
    resizeRef.current = {
      handle,
      startX: touch.clientX,
      startY: touch.clientY,
      width: size.width,
      height: size.height,
      x: pos.x,
      y: pos.y,
    };
    setResizeHandle(handle);
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    if (!resizeHandle) return;
    const handleMove = (e) => {
      const r = resizeRef.current;
      if (!r) return;
      const touch = e.touches?.[0] || e;
      const dx = touch.clientX - r.startX;
      const dy = touch.clientY - r.startY;
      const h = r.handle;
      const { maxW, maxH } = clampBounds();

      let width = r.width;
      let height = r.height;
      if (h.includes('e')) width = r.width + dx;
      if (h.includes('w')) width = r.width - dx;
      if (h.includes('s')) height = r.height + dy;
      if (h.includes('n')) height = r.height - dy;

      width = Math.max(MIN_WIDTH, Math.min(width, maxW));
      height = Math.max(MIN_HEIGHT, Math.min(height, maxH));

      // Dragging the west/north edge also repositions — the opposite
      // (east/south) edge stays anchored in place, matching real
      // window-resize behavior, instead of the whole panel shifting.
      let x = r.x;
      let y = r.y;
      if (h.includes('w')) x = (r.x + r.width) - width;
      if (h.includes('n')) y = (r.y + r.height) - height;

      x = Math.max(-(width - 200), Math.min(x, window.innerWidth - 200));
      y = Math.max(0, Math.min(y, window.innerHeight - TITLE_BAR_HEIGHT));
      // Real bug found in testing: resizing from an edge that doesn't
      // touch x/y (e.g. dragging N or S after an earlier W/E resize had
      // already moved x) could leave the OPPOSITE edge pushed past the
      // viewport — the reachability clamp above only bounds x/y
      // themselves, not the derived right/bottom edge. Since width is
      // already capped to fit within the viewport (maxW/maxH above),
      // there's always room to pull the panel fully back on-screen
      // without shrinking it further.
      if (x + width > window.innerWidth) x = window.innerWidth - width;
      if (y + height > window.innerHeight) y = window.innerHeight - height;

      setSize({ width, height });
      setPos({ x, y });
    };
    const handleEnd = () => setResizeHandle(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [resizeHandle]);

  // Re-clamp on orientation/viewport change so the panel never ends up
  // partially unreachable or oversized after a rotation.
  useEffect(() => {
    const handleViewportChange = () => {
      const { maxW, maxH } = clampBounds();
      setSize(s => ({ width: Math.min(s.width, maxW), height: Math.min(s.height, maxH) }));
      setPos(p => ({
        x: Math.max(-(size.width - 60), Math.min(p.x, window.innerWidth - 60)),
        y: Math.max(0, Math.min(p.y, window.innerHeight - TITLE_BAR_HEIGHT)),
      }));
    };
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Sizing math: rows scale with height, columns scale with width
  // via CSS Grid's own fr units (no JS math needed for width). ----
  const contentH = size.height - TITLE_BAR_HEIGHT;
  const NUM_ROWS = 6; // function, number, top, home, bottom, modifier
  const rowH = contentH / NUM_ROWS;
  const fontSize = Math.max(10, Math.min(18, rowH * 0.32));
  const gap = Math.max(2, Math.min(5, rowH * 0.08));

  const keyStyle = (active = false) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '5px',
    border: active ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.14)',
    background: active ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.07)',
    color: '#fff',
    fontSize: `${fontSize}px`,
    fontFamily: 'inherit',
    userSelect: 'none',
    cursor: 'pointer',
    minWidth: 0,
    minHeight: 0,
    transition: 'background 80ms ease-out, border-color 80ms ease-out',
  });

  const charKey = (pair) => {
    const label = effectiveShift ? pair[1] : pair[0];
    return (
      <button key={pair[0]} onClick={() => handleCharKey(pair)} style={{ ...keyStyle(pressedKey === label), gridColumn: 'span 4' }}>
        {label}
      </button>
    );
  };

  const RESIZE_HANDLES = [
    { id: 'n', style: { top: -HANDLE_SIZE / 2, left: HANDLE_SIZE, right: HANDLE_SIZE, height: HANDLE_SIZE, cursor: 'ns-resize' } },
    { id: 's', style: { bottom: -HANDLE_SIZE / 2, left: HANDLE_SIZE, right: HANDLE_SIZE, height: HANDLE_SIZE, cursor: 'ns-resize' } },
    { id: 'e', style: { right: -HANDLE_SIZE / 2, top: HANDLE_SIZE, bottom: HANDLE_SIZE, width: HANDLE_SIZE, cursor: 'ew-resize' } },
    { id: 'w', style: { left: -HANDLE_SIZE / 2, top: HANDLE_SIZE, bottom: HANDLE_SIZE, width: HANDLE_SIZE, cursor: 'ew-resize' } },
    { id: 'ne', style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, width: HANDLE_SIZE * 1.6, height: HANDLE_SIZE * 1.6, cursor: 'nesw-resize' } },
    { id: 'nw', style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, width: HANDLE_SIZE * 1.6, height: HANDLE_SIZE * 1.6, cursor: 'nwse-resize' } },
    { id: 'se', style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, width: HANDLE_SIZE * 1.6, height: HANDLE_SIZE * 1.6, cursor: 'nwse-resize' } },
    { id: 'sw', style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, width: HANDLE_SIZE * 1.6, height: HANDLE_SIZE * 1.6, cursor: 'nesw-resize' } },
  ];

  return (
    <div style={{
      position: 'fixed',
      left: `${pos.x}px`,
      top: `${pos.y}px`,
      width: `${size.width}px`,
      height: `${size.height}px`,
      zIndex: 300,
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(15,15,18,0.97)',
      border: '1px solid rgba(255,255,255,0.18)',
      borderRadius: '8px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      touchAction: 'none',
    }}>
      {/* Real resize handles — all 4 edges + all 4 corners, matching
          genuine window-resize behavior. */}
      {RESIZE_HANDLES.map(h => (
        <div
          key={h.id}
          onMouseDown={handleResizeStart(h.id)}
          onTouchStart={handleResizeStart(h.id)}
          style={{ position: 'absolute', zIndex: 310, ...h.style }}
        />
      ))}

      {/* Title bar — the real drag handle, styled after Windows OSK. */}
      <div
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        style={{
          height: `${TITLE_BAR_HEIGHT}px`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 6px 0 10px',
          background: 'rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '8px 8px 0 0',
          cursor: 'move',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.75)', fontSize: '12px', fontWeight: 500 }}>
          <GripHorizontal size={13} />
          On-Screen Keyboard
        </span>
        <button
          onClick={onDismiss}
          title="Close keyboard"
          style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', borderRadius: '4px' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Key area: main block (function/number/letter/modifier rows) +
          side cluster (navigation block over arrow block), arranged
          left-to-right like a real full-size keyboard. */}
      <div style={{ flex: 1, display: 'flex', gap: `${gap * 1.5}px`, padding: `${gap}px`, minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: `${gap}px`, minWidth: 0 }}>
          {/* Function row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(58, 1fr)', gap: `${gap}px`, height: `${rowH - gap}px` }}>
            <button onClick={() => handleSpecialKey(KEYSYM.ESCAPE, 'Esc')} style={{ ...keyStyle(pressedKey === 'Esc'), gridColumn: 'span 4' }}>Esc</button>
            <div style={{ gridColumn: 'span 1' }} />
            {FUNCTION_KEYS.map((label, i) => (
              <button
                key={label}
                onClick={() => handleSpecialKey(KEYSYM[label], label)}
                style={{ ...keyStyle(pressedKey === label), gridColumn: `span 4`, marginLeft: (i % 4 === 0 && i > 0) ? `${gap * 2}px` : 0 }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Number row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(58, 1fr)', gap: `${gap}px`, height: `${rowH - gap}px` }}>
            {NUMBER_ROW.map(pair => (
              <button key={pair[0]} onClick={() => handleCharKey(pair)} style={{ ...keyStyle(pressedKey === (effectiveShift ? pair[1] : pair[0])), gridColumn: 'span 4' }}>
                {effectiveShift ? pair[1] : pair[0]}
              </button>
            ))}
            <button onClick={() => handleSpecialKey(KEYSYM.BACKSPACE, 'Backspace')} style={{ ...keyStyle(pressedKey === 'Backspace'), gridColumn: 'span 4' }} title="Backspace">
              <Delete size={fontSize + 2} />
            </button>
          </div>

          {/* Top letter row: Tab Q-P [ ] \ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(58, 1fr)', gap: `${gap}px`, height: `${rowH - gap}px` }}>
            <button onClick={() => handleSpecialKey(KEYSYM.TAB, 'Tab')} style={{ ...keyStyle(pressedKey === 'Tab'), gridColumn: 'span 6' }}>Tab</button>
            {TOP_ROW.map(pair => (
              <button key={pair[0]} onClick={() => handleCharKey(pair)} style={{ ...keyStyle(pressedKey === (effectiveShift ? pair[1] : pair[0])), gridColumn: 'span 4' }}>
                {effectiveShift ? pair[1] : pair[0]}
              </button>
            ))}
          </div>

          {/* Home row: Caps A-' Enter */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(58, 1fr)', gap: `${gap}px`, height: `${rowH - gap}px` }}>
            <button onClick={() => setCapsOn(v => !v)} style={{ ...keyStyle(capsOn), gridColumn: 'span 7' }}>Caps</button>
            {HOME_ROW.map(pair => (
              <button key={pair[0]} onClick={() => handleCharKey(pair)} style={{ ...keyStyle(pressedKey === (effectiveShift ? pair[1] : pair[0])), gridColumn: 'span 4' }}>
                {effectiveShift ? pair[1] : pair[0]}
              </button>
            ))}
            <button onClick={() => handleSpecialKey(KEYSYM.ENTER, 'Enter')} style={{ ...keyStyle(pressedKey === 'Enter'), gridColumn: 'span 5' }} title="Enter">
              <CornerDownLeft size={fontSize + 2} />
            </button>
          </div>

          {/* Bottom letter row: Shift Z-/ Shift */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(58, 1fr)', gap: `${gap}px`, height: `${rowH - gap}px` }}>
            <button onClick={() => setShiftOn(v => !v)} style={{ ...keyStyle(shiftOn), gridColumn: 'span 9' }}>Shift</button>
            {BOTTOM_ROW.map(pair => (
              <button key={pair[0]} onClick={() => handleCharKey(pair)} style={{ ...keyStyle(pressedKey === (effectiveShift ? pair[1] : pair[0])), gridColumn: 'span 4' }}>
                {effectiveShift ? pair[1] : pair[0]}
              </button>
            ))}
            <button onClick={() => setShiftOn(v => !v)} style={{ ...keyStyle(shiftOn), gridColumn: 'span 7' }}>Shift</button>
          </div>

          {/* Modifier row: Ctrl Win Alt Space Alt Ctrl */}
          <div style={{ display: 'flex', gap: `${gap}px`, height: `${rowH - gap}px` }}>
            <button onClick={() => toggleHeld(KEYSYM.CONTROL_L)} style={{ ...keyStyle(!!held[KEYSYM.CONTROL_L]), flex: 1.6 }}>Ctrl</button>
            <button onClick={() => toggleHeld(KEYSYM.SUPER_L)} style={{ ...keyStyle(!!held[KEYSYM.SUPER_L]), flex: 1.3 }}>Win</button>
            <button onClick={() => toggleHeld(KEYSYM.ALT_L)} style={{ ...keyStyle(!!held[KEYSYM.ALT_L]), flex: 1.3 }}>Alt</button>
            <button onClick={() => handleSpecialKey(KEYSYM.SPACE, 'Space')} style={{ ...keyStyle(pressedKey === 'Space'), flex: 6.5 }}>&nbsp;</button>
            <button onClick={() => toggleHeld(KEYSYM.ALT_R)} style={{ ...keyStyle(!!held[KEYSYM.ALT_R]), flex: 1.3 }}>Alt</button>
            <button onClick={() => toggleHeld(KEYSYM.CONTROL_R)} style={{ ...keyStyle(!!held[KEYSYM.CONTROL_R]), flex: 1.6 }}>Ctrl</button>
          </div>
        </div>

        {/* Side cluster: navigation block (2 rows x 3) stacked above the
            arrow block (inverted-T), positioned to the right — matching
            a real full-size keyboard and Windows OSK's own layout. */}
        <div style={{ width: `${Math.max(150, size.width * 0.19)}px`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: `${gap * 1.5}px` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: `${gap}px`, height: `${rowH * 2 + gap}px` }}>
            <button onClick={() => handleSpecialKey(KEYSYM.INSERT, 'Insert')} style={{ ...keyStyle(pressedKey === 'Insert'), fontSize: `${fontSize * 0.75}px` }}>Ins</button>
            <button onClick={() => handleSpecialKey(KEYSYM.HOME, 'Home')} style={{ ...keyStyle(pressedKey === 'Home'), fontSize: `${fontSize * 0.75}px` }}>Home</button>
            <button onClick={() => handleSpecialKey(KEYSYM.PAGE_UP, 'PgUp')} style={{ ...keyStyle(pressedKey === 'PgUp'), fontSize: `${fontSize * 0.75}px` }}>PgUp</button>
            <button onClick={() => handleSpecialKey(KEYSYM.DELETE, 'Delete')} style={{ ...keyStyle(pressedKey === 'Delete'), fontSize: `${fontSize * 0.75}px` }}>Del</button>
            <button onClick={() => handleSpecialKey(KEYSYM.END, 'End')} style={{ ...keyStyle(pressedKey === 'End'), fontSize: `${fontSize * 0.75}px` }}>End</button>
            <button onClick={() => handleSpecialKey(KEYSYM.PAGE_DOWN, 'PgDn')} style={{ ...keyStyle(pressedKey === 'PgDn'), fontSize: `${fontSize * 0.75}px` }}>PgDn</button>
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: `${gap}px` }}>
            <div />
            <button onClick={() => handleSpecialKey(KEYSYM.ARROW_UP, 'Up')} title="Up" style={keyStyle(pressedKey === 'Up')}><ArrowUp size={fontSize} /></button>
            <div />
            <button onClick={() => handleSpecialKey(KEYSYM.ARROW_LEFT, 'Left')} title="Left" style={keyStyle(pressedKey === 'Left')}><ArrowLeft size={fontSize} /></button>
            <button onClick={() => handleSpecialKey(KEYSYM.ARROW_DOWN, 'Down')} title="Down" style={keyStyle(pressedKey === 'Down')}><ArrowDown size={fontSize} /></button>
            <button onClick={() => handleSpecialKey(KEYSYM.ARROW_RIGHT, 'Right')} title="Right" style={keyStyle(pressedKey === 'Right')}><ArrowRight size={fontSize} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

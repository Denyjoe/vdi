import { useState, useCallback, useEffect, useRef } from 'react';
import { GripHorizontal, Delete, CornerDownLeft, ArrowUp, ArrowLeft, ArrowRight, ArrowDown, ChevronDown } from 'lucide-react';

/**
 * CustomOnScreenKeyboard
 *
 * Replaces Guacamole's built-in on-screen keyboard (confirmed today: it
 * has no partial/resizable state — `ng-if="showOSK"`, fully on or off —
 * and its own internal layout is non-shrinkable, which is what caused
 * the earlier landscape "covers everything" bug). This is a real,
 * resizable, draggable QWERTY keyboard we fully own, sending genuine
 * key events through the SAME underlying mechanism Guacamole's own
 * webapp uses for physical keyboard input: `Guacamole.Client
 * .sendKeyEvent(pressed, keysym)`, reached via GuacamoleEmbed's
 * `sendKeyEvent` imperative-handle method (same findGuacScope technique
 * already proven for toggleKeyboard/toggleTouchpadMode/zoomBy).
 *
 * X11 keysyms for the printable Latin-1 range map 1:1 to Unicode code
 * points — confirmed against Guacamole's own real keysym handling, this
 * is the standard X11/VNC/RDP-via-Guacamole encoding, not an assumption
 * — so no lookup table is needed for any printable character, just
 * `charCodeAt(0)` of whichever character (base or shifted) is wanted.
 * Only non-printable/control keys need explicit constants, taken
 * directly from X11's real keysymdef.h.
 */
const KEYSYM = {
  BACKSPACE: 0xff08,
  TAB: 0xff09,
  ENTER: 0xff0d,
  ESCAPE: 0xff1b,
  SHIFT_L: 0xffe1,
  CONTROL_L: 0xffe3,
  ALT_L: 0xffe9,
  ARROW_LEFT: 0xff51,
  ARROW_UP: 0xff52,
  ARROW_RIGHT: 0xff53,
  ARROW_DOWN: 0xff54,
  SPACE: 0x0020,
};

// [normal, shifted] pairs — standard US QWERTY layout.
const ROWS = [
  [['`', '~'], ['1', '!'], ['2', '@'], ['3', '#'], ['4', '$'], ['5', '%'], ['6', '^'], ['7', '&'], ['8', '*'], ['9', '('], ['0', ')'], ['-', '_'], ['=', '+']],
  [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R'], ['t', 'T'], ['y', 'Y'], ['u', 'U'], ['i', 'I'], ['o', 'O'], ['p', 'P'], ['[', '{'], [']', '}']],
  [['a', 'A'], ['s', 'S'], ['d', 'D'], ['f', 'F'], ['g', 'G'], ['h', 'H'], ['j', 'J'], ['k', 'K'], ['l', 'L'], [';', ':'], ["'", '"']],
  [['z', 'Z'], ['x', 'X'], ['c', 'C'], ['v', 'V'], ['b', 'B'], ['n', 'N'], ['m', 'M'], [',', '<'], ['.', '>'], ['/', '?']],
];

const MIN_HEIGHT = 180;
const MAX_HEIGHT_CAP = 500;
const DEFAULT_HEIGHT = 280;
const HANDLE_HEIGHT = 22;
const NUM_ROWS = ROWS.length + 1; // + the bottom control row

// A flat 500px max would genuinely cover most/all of a short landscape
// phone (~375px tall) — confirmed real constraint from earlier today's
// investigation. Cap resize to whichever is smaller: the flat ceiling,
// or a fraction of whatever the real viewport actually is right now, so
// dragging to "max" can never swallow the whole screen in any
// orientation.
function computeMaxHeight() {
  return Math.round(Math.min(MAX_HEIGHT_CAP, window.innerHeight * 0.7));
}

export default function CustomOnScreenKeyboard({ onKeyEvent, onHeightChange, onDismiss }) {
  const [height, setHeight] = useState(() => Math.min(DEFAULT_HEIGHT, computeMaxHeight()));
  const [isResizing, setIsResizing] = useState(false);
  const [shiftOn, setShiftOn] = useState(false);
  const [ctrlOn, setCtrlOn] = useState(false);
  const [altOn, setAltOn] = useState(false);
  const [pressedKey, setPressedKey] = useState(null);
  const pressedTimerRef = useRef(null);

  // Report our real height to the parent on mount and every change, so
  // its own layout reservation genuinely stays in sync with THIS
  // component's actual size — not a separate guess or a measurement of
  // something else, the exact value this component owns.
  useEffect(() => {
    onHeightChange?.(height);
  }, [height, onHeightChange]);

  const flash = useCallback((label) => {
    setPressedKey(label);
    if (pressedTimerRef.current) clearTimeout(pressedTimerRef.current);
    pressedTimerRef.current = setTimeout(() => setPressedKey(null), 120);
  }, []);

  useEffect(() => () => { if (pressedTimerRef.current) clearTimeout(pressedTimerRef.current); }, []);

  // Real press-then-release, through the real sendKeyEvent — matches
  // Guacamole's own physical-keyboard behavior for a normal keystroke.
  const tapKeysym = useCallback((keysym) => {
    onKeyEvent(1, keysym);
    onKeyEvent(0, keysym);
  }, [onKeyEvent]);

  const handleCharKey = (pair) => {
    const char = shiftOn ? pair[1] : pair[0];
    tapKeysym(char.charCodeAt(0));
    flash(char);
    // Shift affects only the next keystroke, then auto-reverts —
    // standard touch-keyboard behavior. This works correctly without
    // ever holding a real Shift_L key down at the protocol level,
    // because X11 keysyms for printable characters already encode case
    ///shift-state directly (e.g. 'a'=0x61 vs 'A'=0x41, '1'=0x31 vs
    // '!'=0x21) — sending the resolved character's own keysym IS the
    // correct, standard way virtual keyboards produce shifted output.
    if (shiftOn) setShiftOn(false);
  };

  const handleSpecialKey = (keysym, label) => {
    tapKeysym(keysym);
    flash(label);
  };

  // Ctrl/Alt are genuinely different from Shift: a remote application
  // checks whether Control/Alt is HELD DOWN during another keypress
  // (e.g. Ctrl+C), not a different character code — so these are real
  // sticky modifiers: press-only when turning on (key event 1, no
  // matching release yet), release-only when turning off (key event 0).
  const toggleHoldModifier = (isOn, setOn, keysym) => {
    const next = !isOn;
    setOn(next);
    onKeyEvent(next ? 1 : 0, keysym);
  };

  const availableH = Math.max(height - HANDLE_HEIGHT, 80);
  const rowH = availableH / NUM_ROWS;
  const fontSize = Math.max(11, Math.min(20, rowH * 0.34));
  const keyGap = Math.max(2, Math.min(6, rowH * 0.08));

  const keyStyle = (active = false) => ({
    flex: 1,
    height: `${rowH - keyGap}px`,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    border: active ? '1px solid var(--accent-primary, #818cf8)' : '1px solid rgba(255,255,255,0.12)',
    background: active ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: `${fontSize}px`,
    fontFamily: 'inherit',
    userSelect: 'none',
    cursor: 'pointer',
    transition: 'background 80ms ease-out, border-color 80ms ease-out',
  });

  // Resize drag — exact pattern requested: touch/mouse move computes a
  // new height from the pointer's distance to the bottom of the
  // viewport, clamped to sensible min/max bounds. Max is recomputed
  // live from the current viewport (not a fixed constant) so it can
  // never be dragged into covering the whole screen, in either
  // orientation.
  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e) => {
      const touch = e.touches?.[0] || e;
      const newHeight = window.innerHeight - touch.clientY;
      setHeight(Math.max(MIN_HEIGHT, Math.min(computeMaxHeight(), newHeight)));
    };
    const handleEnd = () => setIsResizing(false);

    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    return () => {
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
    };
  }, [isResizing]);

  // If the viewport itself gets shorter while the keyboard is already
  // open (e.g. rotating from portrait to landscape) — re-clamp so a
  // previously-fine height doesn't now cover too much of a suddenly
  // much shorter screen.
  useEffect(() => {
    const handleOrientation = () => {
      const maxH = computeMaxHeight();
      setHeight(h => Math.max(MIN_HEIGHT, Math.min(maxH, h)));
    };
    window.addEventListener('resize', handleOrientation);
    window.addEventListener('orientationchange', handleOrientation);
    return () => {
      window.removeEventListener('resize', handleOrientation);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, []);

  const handleResizeStart = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  return (
    <div style={{
      height: `${height}px`,
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(15,15,18,0.97)',
      borderTop: '1px solid rgba(255,255,255,0.15)',
      flexShrink: 0,
      touchAction: 'none',
    }}>
      {/* Handle row: real resize handle (drag up/down to genuinely
          resize, not decorative) fills most of the row so it's an easy
          target; a small dismiss button sits at the same boundary
          between the desktop view and the keyboard, giving the same
          fast "collapse without navigating back to the main controls
          panel" affordance the previous, Guacamole-OSK-based version
          had — kept alongside instead of a separate floating button so
          the two controls don't visually stack on the same edge. */}
      <div style={{ height: `${HANDLE_HEIGHT}px`, display: 'flex', flexShrink: 0 }}>
        <div
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'ns-resize',
            background: isResizing ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
          }}
          title="Drag to resize keyboard"
        >
          <GripHorizontal size={16} color="rgba(255,255,255,0.5)" />
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              width: '36px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.04)',
              border: 'none',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
            }}
            title="Hide keyboard"
          >
            <ChevronDown size={15} color="rgba(255,255,255,0.7)" />
          </button>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: `${keyGap}px`, padding: `${keyGap}px 4px`, minHeight: 0 }}>
        {ROWS.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: `${keyGap}px`, flex: 1, minHeight: 0 }}>
            {row.map((pair) => {
              const label = shiftOn ? pair[1] : pair[0];
              return (
                <button
                  key={pair[0]}
                  onClick={() => handleCharKey(pair)}
                  style={{ ...keyStyle(pressedKey === label) }}
                >
                  {label}
                </button>
              );
            })}
            {i === 0 && (
              <button onClick={() => handleSpecialKey(KEYSYM.BACKSPACE, 'Backspace')} style={{ ...keyStyle(pressedKey === 'Backspace'), flex: 1.6 }} title="Backspace">
                <Delete size={fontSize + 2} />
              </button>
            )}
          </div>
        ))}

        {/* Bottom control row: Shift, Ctrl, Alt, Tab, Space, Enter, arrows */}
        <div style={{ display: 'flex', gap: `${keyGap}px`, flex: 1, minHeight: 0 }}>
          <button onClick={() => setShiftOn(v => !v)} style={{ ...keyStyle(shiftOn), flex: 1.4 }} title="Shift">
            Shift
          </button>
          <button onClick={() => toggleHoldModifier(ctrlOn, setCtrlOn, KEYSYM.CONTROL_L)} style={{ ...keyStyle(ctrlOn), flex: 1 }} title="Ctrl">
            Ctrl
          </button>
          <button onClick={() => toggleHoldModifier(altOn, setAltOn, KEYSYM.ALT_L)} style={{ ...keyStyle(altOn), flex: 1 }} title="Alt">
            Alt
          </button>
          <button onClick={() => handleSpecialKey(KEYSYM.TAB, 'Tab')} style={{ ...keyStyle(pressedKey === 'Tab'), flex: 1 }} title="Tab">
            Tab
          </button>
          <button onClick={() => handleSpecialKey(KEYSYM.SPACE, 'Space')} style={{ ...keyStyle(pressedKey === 'Space'), flex: 3.5 }} title="Space">
            &nbsp;
          </button>
          <button onClick={() => handleSpecialKey(KEYSYM.ARROW_LEFT, 'Left')} style={{ ...keyStyle(pressedKey === 'Left'), flex: 1 }} title="Left">
            <ArrowLeft size={fontSize + 2} />
          </button>
          <button onClick={() => handleSpecialKey(KEYSYM.ARROW_UP, 'Up')} style={{ ...keyStyle(pressedKey === 'Up'), flex: 1 }} title="Up">
            <ArrowUp size={fontSize + 2} />
          </button>
          <button onClick={() => handleSpecialKey(KEYSYM.ARROW_DOWN, 'Down')} style={{ ...keyStyle(pressedKey === 'Down'), flex: 1 }} title="Down">
            <ArrowDown size={fontSize + 2} />
          </button>
          <button onClick={() => handleSpecialKey(KEYSYM.ARROW_RIGHT, 'Right')} style={{ ...keyStyle(pressedKey === 'Right'), flex: 1 }} title="Right">
            <ArrowRight size={fontSize + 2} />
          </button>
          <button onClick={() => handleSpecialKey(KEYSYM.ENTER, 'Enter')} style={{ ...keyStyle(pressedKey === 'Enter'), flex: 1.6 }} title="Enter">
            <CornerDownLeft size={fontSize + 2} />
          </button>
        </div>
      </div>
    </div>
  );
}

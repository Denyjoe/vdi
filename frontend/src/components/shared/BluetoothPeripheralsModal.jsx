import { useState, useEffect, useCallback } from 'react';
import { Bluetooth, Keyboard, MousePointer2, Settings, CheckCircle2, X, Search, Loader2, AlertCircle } from 'lucide-react';

/**
 * Bluetooth Peripherals Manager modal.
 *
 * Uses the Web Bluetooth API (navigator.bluetooth.requestDevice) to let
 * users scan and pair BLE keyboards/mice directly from the browser.
 * Falls back to passive event-based detection for browsers that don't
 * support the API (e.g. iOS Safari), and always runs event-based
 * detection in parallel as a secondary confirmation signal.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {Function} props.onClose - Called when the user dismisses the modal.
 */
export default function BluetoothPeripheralsModal({ isOpen, onClose }) {
  const [keyboardDetected, setKeyboardDetected] = useState(false);
  const [mouseDetected, setMouseDetected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pairedDevice, setPairedDevice] = useState(null);
  const [error, setError] = useState(null);
  const [bluetoothSupported, setBluetoothSupported] = useState(true);

  /** Check Web Bluetooth API availability on mount. */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      setBluetoothSupported(false);
    }
  }, []);

  /** Passive event-based detection for external keyboard and mouse. */
  useEffect(() => {
    if (!isOpen) {
      setKeyboardDetected(false);
      setMouseDetected(false);
      return;
    }

    /**
     * Detects physical keyboard input.
     * Any real keydown with a recognisable key name counts.
     */
    const handleKeyDown = (e) => {
      if (e.key && e.key !== 'Unidentified') {
        setKeyboardDetected(true);
      }
    };

    /**
     * Detects physical mouse via pointermove (NOT mousemove).
     * pointermove exposes pointerType which lets us distinguish
     * 'mouse' from 'touch' — mousemove doesn't have this field.
     */
    const handlePointerMove = (e) => {
      if (e.pointerType === 'mouse') {
        setMouseDetected(true);
      }
    };

    /** Mouse wheel is never triggered by touch — reliable mouse signal. */
    const handleWheel = () => {
      setMouseDetected(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('wheel', handleWheel);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen]);

  /**
   * Initiates a Web Bluetooth scan for HID peripherals.
   *
   * Uses acceptAllDevices since Bluetooth HID keyboards/mice don't
   * advertise standardised GATT services that can be filtered by
   * the browser's service UUID filter. The browser's native picker
   * handles security — the user must explicitly select a device.
   */
  const handleScanDevices = useCallback(async () => {
    setError(null);
    setScanning(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information', 'human_interface_device'],
      });
      setPairedDevice({
        name: device.name || 'Unknown Device',
        id: device.id,
      });
      // Listen for disconnect
      device.addEventListener('gattserverdisconnected', () => {
        setPairedDevice(null);
      });
    } catch (err) {
      // User cancelled the picker — not an error
      if (err.name !== 'NotFoundError') {
        setError(err.message || 'Failed to scan for devices');
      }
    } finally {
      setScanning(false);
    }
  }, []);

  /** Reset state on close to keep modal fresh on re-open. */
  useEffect(() => {
    if (!isOpen) {
      setScanning(false);
      setError(null);
      // Don't clear pairedDevice — it persists for the session
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      style={{ zIndex: 99999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-card border border-border-strong rounded-2xl overflow-hidden w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]"
        style={{ background: 'var(--bg-canvas, #050B18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-[var(--bg-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Bluetooth size={18} className="text-blue-400" />
            </div>
            <h2 className="text-[var(--text-primary)] font-semibold text-base">Bluetooth Peripherals</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:bg-white/5 transition-colors active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          <p className="text-sm text-secondary mb-5 leading-relaxed">
            Connect a wireless keyboard or mouse via Bluetooth to use this workspace like a real computer.
          </p>

          {/* Scan Button */}
          {bluetoothSupported ? (
            <button
              type="button"
              onClick={handleScanDevices}
              disabled={scanning}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] mb-5"
              style={{
                background: scanning ? 'rgba(59,130,246,0.1)' : 'linear-gradient(135deg, #3B82F6, #6366F1)',
                color: scanning ? '#60a5fa' : '#fff',
                border: scanning ? '1px solid rgba(59,130,246,0.3)' : 'none',
                cursor: scanning ? 'not-allowed' : 'pointer',
              }}
            >
              {scanning ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Scanning for devices...
                </>
              ) : (
                <>
                  <Search size={16} />
                  Scan for Bluetooth Devices
                </>
              )}
            </button>
          ) : (
            /* Fallback instructions for browsers without Web Bluetooth (iOS Safari) */
            <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-amber-300 font-medium mb-1">Web Bluetooth not available</p>
                  <p className="text-xs text-amber-400/70 leading-relaxed">
                    Your browser doesn't support direct Bluetooth scanning. 
                    Pair your device through your phone's Bluetooth settings first, then come back here to verify the connection.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Paired Device */}
          {pairedDevice && (
            <div className="mb-5 flex items-center gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25">
              <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Bluetooth size={16} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{pairedDevice.name}</p>
                <p className="text-xs text-blue-400">Paired via Web Bluetooth</p>
              </div>
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Manual Pairing Guide */}
          <div className="space-y-3.5 mb-6">
            <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider">Manual Pairing</h4>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">1</div>
              <div>
                <p className="text-[13px] text-[var(--text-primary)] font-medium">Turn on pairing mode</p>
                <p className="text-xs text-muted mt-0.5">Hold the pairing button on your keyboard or mouse.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">2</div>
              <div>
                <p className="text-[13px] text-[var(--text-primary)] font-medium">Open device settings</p>
                <p className="text-xs text-muted mt-0.5">
                  Go to <span className="inline-flex items-center gap-1 text-blue-400 font-medium"><Settings size={11} /> Settings &gt; Bluetooth</span> and select your device.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">3</div>
              <div>
                <p className="text-[13px] text-[var(--text-primary)] font-medium">Test below</p>
                <p className="text-xs text-muted mt-0.5">Type a key or move the mouse to verify.</p>
              </div>
            </div>
          </div>

          {/* Live Detection */}
          <div className="bg-[var(--bg-primary)] border border-border-subtle rounded-xl p-4">
            <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Live Detection</h4>
            <div className="space-y-2.5">
              {/* Keyboard */}
              <div className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${keyboardDetected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-transparent'}`}>
                <div className="flex items-center gap-3">
                  <Keyboard size={18} className={keyboardDetected ? 'text-emerald-400' : 'text-muted'} />
                  <span className={`text-sm font-medium ${keyboardDetected ? 'text-emerald-400' : 'text-muted'}`}>External Keyboard</span>
                </div>
                {keyboardDetected ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/20 px-2 py-1 rounded-md">
                    <CheckCircle2 size={12} /> Connected
                  </div>
                ) : (
                  <span className="text-xs text-faint italic animate-pulse">Listening...</span>
                )}
              </div>
              {/* Mouse */}
              <div className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${mouseDetected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-transparent'}`}>
                <div className="flex items-center gap-3">
                  <MousePointer2 size={18} className={mouseDetected ? 'text-emerald-400' : 'text-muted'} />
                  <span className={`text-sm font-medium ${mouseDetected ? 'text-emerald-400' : 'text-muted'}`}>External Mouse</span>
                </div>
                {mouseDetected ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/20 px-2 py-1 rounded-md">
                    <CheckCircle2 size={12} /> Connected
                  </div>
                ) : (
                  <span className="text-xs text-faint italic animate-pulse">Listening...</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-[var(--bg-primary)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

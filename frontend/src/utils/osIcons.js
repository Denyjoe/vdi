// Real, correctly-licensed OS/distro icons via react-icons (Simple Icons +
// Font Awesome sets bundled as proper React components) — replaces any
// manually-uploaded or hardcoded per-template icon for OS identity.
import {
  SiUbuntu, SiDebian, SiFedora, SiKalilinux, SiArchlinux, SiCentos,
  SiLinuxmint, SiZorin, SiParrotsecurity,
} from 'react-icons/si';
import { FaWindows, FaApple, FaLinux } from 'react-icons/fa';

export const OS_ICON_MAP = {
  ubuntu: SiUbuntu,
  debian: SiDebian,
  fedora: SiFedora,
  kali: SiKalilinux,
  arch: SiArchlinux,
  centos: SiCentos,
  mint: SiLinuxmint,
  zorin: SiZorin,
  parrot: SiParrotsecurity,
  windows: FaWindows,
  macos: FaApple,
  linux: FaLinux, // generic fallback
};

// Real per-brand colors so the fallback-to-lucide path some pages still
// use for non-OS icons doesn't clash visually with these.
export const OS_ICON_COLOR = {
  ubuntu: '#E95420',
  debian: '#A81D33',
  fedora: '#51A2DA',
  kali: '#557C94',
  arch: '#1793D1',
  centos: '#932279',
  mint: '#87CF3E',
  zorin: '#16A0ED',
  parrot: '#15E0AD',
  windows: '#00A4EF',
  macos: '#000000',
  linux: '#000000',
};

/**
 * Resolve a real OS icon component from an os_family key (preferred) or,
 * failing that, a free-text OS/template name (best-effort first-word
 * match, kept only as a fallback for rows without os_family set).
 */
export function getOsIcon(osFamilyOrName) {
  const key = osFamilyOrName?.toLowerCase().trim().split(/[\s-]/)[0];
  return OS_ICON_MAP[key] || FaLinux;
}

export function getOsIconColor(osFamilyOrName) {
  const key = osFamilyOrName?.toLowerCase().trim().split(/[\s-]/)[0];
  return OS_ICON_COLOR[key] || 'currentColor';
}

import React from 'react';
import { siUbuntu, siZorin } from 'simple-icons';

export const OS_ICONS = {
  'Ubuntu Desktop': siUbuntu,
  'Zorin Desktop': siZorin,
};

export default function OsIcon({ templateName, size = 24, color }) {
  const icon = OS_ICONS[templateName];
  
  if (!icon) {
    return null; // caller should fall back to lucide icon
  }
  
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color || `#${icon.hex}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  );
}

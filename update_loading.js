const fs = require('fs');

// 1. Update GuacamoleEmbed.jsx
let embed = fs.readFileSync('frontend/src/components/shared/GuacamoleEmbed.jsx', 'utf8');
embed = embed.replace(
  /export default function GuacamoleEmbed\({ url, title = "Virtual Desktop", className = "w-full flex-1 border-none bg-black" }\)/,
  'export default function GuacamoleEmbed({ url, title = "Virtual Desktop", className = "w-full flex-1 border-none bg-black", loadingText = "Connecting..." })'
);
embed = embed.replace(/<h2.*?Connecting...<\/h2>\s*<p.*?Securing desktop stream<\/p>/g, '<h2 className="text-[var(--text-primary, #fff)] text-xl font-semibold mb-2">{loadingText}</h2>');
fs.writeFileSync('frontend/src/components/shared/GuacamoleEmbed.jsx', embed, 'utf8');

// 2. Update DesktopSessionPage.jsx
let desktopPage = fs.readFileSync('frontend/src/pages/member/DesktopSessionPage.jsx', 'utf8');
desktopPage = desktopPage.replace(/<GuacamoleEmbed url={workspace\.vm_details\.guacamole_url} \/>/g, '<GuacamoleEmbed url={workspace.vm_details.guacamole_url} loadingText="Connecting to your workspace..." />');
desktopPage = desktopPage.replace(/<GuacamoleEmbed url={sessionData\.guacamole_url} \/>/g, '<GuacamoleEmbed url={sessionData.guacamole_url} loadingText="Connecting to your session..." />');
fs.writeFileSync('frontend/src/pages/member/DesktopSessionPage.jsx', desktopPage, 'utf8');

// 3. Update HostSessionPage.jsx
let hostPage = fs.readFileSync('frontend/src/pages/HostSessionPage.jsx', 'utf8');
hostPage = hostPage.replace(
  /<GuacamoleEmbed\s*\n\s*url={viewScreenParticipant\.guacamole_url}/g,
  '<GuacamoleEmbed\n              loadingText="Connecting to participant screen..."\n              url={viewScreenParticipant.guacamole_url}'
);
fs.writeFileSync('frontend/src/pages/HostSessionPage.jsx', hostPage, 'utf8');


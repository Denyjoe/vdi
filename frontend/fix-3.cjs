const fs = require('fs');

let join = fs.readFileSync('src/components/shared/JoinByCodeModal.jsx', 'utf8');
// Fix the text-white title and subtitle
join = join.replace(/text-white/g, 'text-[var(--text-primary)]');
// Restore text-white for the primary button and success text if any
join = join.replace(/text-\[var\(--text-primary\)\] text-sm font-semibold hover:bg-\[#0052CC\]/g, 'text-white text-sm font-semibold hover:bg-[#0052CC]');
// Fix the "Enter Session Now" button
join = join.replace(/bg-\[#0066FF\] hover:bg-\[#0052CC\] text-\[var\(--text-primary\)\]/g, 'bg-[#0066FF] hover:bg-[#0052CC] text-white');
// Fix the "Join Session" primary button
join = join.replace(/bg-\[#0066FF\] text-\[var\(--text-primary\)\] text-sm/g, 'bg-[#0066FF] text-white text-sm');

fs.writeFileSync('src/components/shared/JoinByCodeModal.jsx', join);

let sidebar = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');

// The bottom connection status:
// The user says "green connection/signal status button at the bottom of the sidebar navigation"
// Let's replace the neon green styles with emerald green pastel styles.
// bg-[#00FF87]/10 -> bg-[#DCFCE7] dark:bg-[#00FF87]/10
// text-[#00FF87] -> text-[#15803D] dark:text-[#00FF87]

sidebar = sidebar.replace(/bg-\[#00FF87\]\/10/g, 'bg-[#DCFCE7] dark:bg-[#00FF87]/10 border border-[#BBF7D0] dark:border-transparent');
sidebar = sidebar.replace(/text-\[#00FF87\]/g, 'text-[#15803D] dark:text-[#00FF87]');

fs.writeFileSync('src/components/layout/Sidebar.jsx', sidebar);

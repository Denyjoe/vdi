const fs = require('fs');
let sidebar = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');

sidebar = sidebar.replace(/<Radio size=\{16\} className="text-\[#15803D\] dark:text-\[#00FF87\]" \/>/g, '<Radio size={16} strokeWidth={2} className="text-[#15803D] dark:text-[#00FF87]" />');
sidebar = sidebar.replace(/bg-\[#00FF87\] animate-pulse/g, 'bg-[#15803D] dark:bg-[#00FF87] animate-pulse');

fs.writeFileSync('src/components/layout/Sidebar.jsx', sidebar);

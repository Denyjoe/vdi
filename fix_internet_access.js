const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/member/CreateSessionPage.jsx', 'utf8');

// Remove state property
content = content.replace(/\s*internet_access:\s*true,/, '');

// Remove toggle component
content = content.replace(/<ControlToggle\s+label="Internet Access"[\s\S]*?\/>/g, '');

fs.writeFileSync('frontend/src/pages/member/CreateSessionPage.jsx', content, 'utf8');

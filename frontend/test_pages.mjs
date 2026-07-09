import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push('BROWSER ERROR: ' + msg.text());
    }
  });
  
  page.on('pageerror', err => {
    errors.push('PAGE ERROR: ' + err.message);
  });

  const pages = [
    '/admin/dashboard',
    '/admin/users',
    '/admin/vm-pool',
    '/admin/templates',
    '/admin/analytics',
    '/admin/settings',
    '/admin/sessions'
  ];

  try {
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('dit-auth-storage', JSON.stringify({
        state: { user: { role: 'admin', email: 'admin@dit.ac.tz' }, token: 'fake' },
        version: 0
      }));
    });
    
    for (const p of pages) {
      console.log('Navigating to', p);
      await page.goto('http://localhost:5173' + p, { waitUntil: 'networkidle0' });
      // wait a bit for any async React updates that might throw
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch(e) {
    console.error("Puppeteer Script Error:", e);
  }
  
  if (errors.length > 0) {
    console.log("ERRORS FOUND:");
    console.log(errors.join('\n'));
  } else {
    console.log("ALL PAGES LOADED WITH ZERO ERRORS!");
  }
  
  await browser.close();
})();

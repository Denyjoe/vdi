import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
  });

  try {
    // Go to login page, set localStorage, then go to settings
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('dit-auth-storage', JSON.stringify({
        state: { user: { role: 'admin', email: 'admin@dit.ac.tz' }, token: 'fake' },
        version: 0
      }));
    });
    console.log("Navigating to settings...");
    await page.goto('http://localhost:5173/admin/settings', { waitUntil: 'networkidle0' });
    console.log("Navigation complete.");
  } catch(e) {
    console.error(e);
  }
  
  await browser.close();
})();

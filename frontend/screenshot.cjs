const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ defaultViewport: { width: 1280, height: 800 } });
  const page = await browser.newPage();
  
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.method() === 'OPTIONS') {
      request.respond({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
      return;
    }
    
    if (request.url().includes('/auth/me/')) {
      request.respond({
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 1, role: 'member', first_name: 'Denis', last_name: 'Wilson', email: 'denis@test.com' }
        })
      });
    } else if (request.url().includes('/workspaces/') || request.url().includes('/settings/') || request.url().includes('/vms/') || request.url().includes('/notifications/') || request.url().includes('/auth/profile/stats/')) {
      request.respond({
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] })
      });
    } else {
      request.continue();
    }
  });

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('dit_access_token', 'fake-token');
    localStorage.setItem('dit_refresh_token', 'fake-refresh');
  });
  
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();

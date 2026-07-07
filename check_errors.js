const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR:', msg.text());
    } else {
      console.log('PAGE LOG:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('UNCAUGHT EXCEPTION:', error.message);
  });

  try {
    await page.goto('http://localhost:5173');
    await new Promise(r => setTimeout(r, 2000));
  } catch (err) {
    console.error('FAILED TO LOAD PAGE:', err.message);
  }

  await browser.close();
})();

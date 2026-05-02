const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.setCacheEnabled(false);

  console.log('Loading page...');
  await page.goto('http://localhost:8765', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  // Activate admin key so dossier is unlocked
  await page.evaluate(() => {
    localStorage.setItem('gi:license', 'GIDEON-ADM-EDACA498');
  });

  // Reload with key active
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4000));

  // Close any open modals
  await page.evaluate(() => {
    document.querySelectorAll('.li-modal, .dos-modal-overlay').forEach(n => n.remove());
  });

  // Click DOSSIER tab
  await page.evaluate(() => {
    const tab = document.querySelector('[data-tab="dossier"]');
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 300));

  // Set target and sweep
  // Switch to USERNAME tab
  await page.evaluate(() => {
    const tab = document.querySelector('[data-tab="user"]');
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 300));

  await page.evaluate(() => {
    const inp = document.getElementById('user-input');
    if (inp) { inp.value = 'magnus'; inp.dispatchEvent(new Event('input')); }
  });
  await new Promise(r => setTimeout(r, 200));

  await page.evaluate(() => {
    const btn = document.getElementById('user-go');
    if (btn) btn.click();
  });

  console.log('Username sweep running, waiting 28s for enrichment...');
  await new Promise(r => setTimeout(r, 28000));

  // Close any modals that appeared
  await page.evaluate(() => {
    document.querySelectorAll('.li-modal, .dos-modal-overlay').forEach(n => n.remove());
  });

  // Screenshot the full page
  await page.screenshot({ path: 'screenshot_full.png' });
  console.log('Saved: screenshot_full.png');

  // Clip just the recon panel
  const panelBox = await page.evaluate(() => {
    const el = document.querySelector('.recon-panel');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  if (panelBox) {
    await page.screenshot({
      path: 'screenshot_panel.png',
      clip: { x: panelBox.x, y: panelBox.y, width: panelBox.width, height: Math.min(panelBox.height, 900) }
    });
    console.log('Saved: screenshot_panel.png');

    // Filter to big platforms with known APIs to show rich enrichment
    await page.evaluate(() => {
      const inp = document.querySelector('.wmn-card-search');
      if (inp) {
        inp.value = '';
        inp.dispatchEvent(new Event('input'));
      }
    });
    await new Promise(r => setTimeout(r, 300));

    // Scroll first enriched found card into view
    await page.evaluate(() => {
      const enriched = [...document.querySelectorAll('.wmn-card-found')]
        .find(c => c.querySelectorAll('.dos-irow').length > 3);
      if (enriched) enriched.scrollIntoView({ behavior: 'instant', block: 'start' });
      else {
        const found = document.querySelector('.wmn-card-found');
        if (found) found.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    });
    await new Promise(r => setTimeout(r, 400));

    await page.screenshot({
      path: 'screenshot_found_cards.png',
      clip: { x: panelBox.x, y: 0, width: panelBox.width, height: 900 }
    });
    console.log('Saved: screenshot_found_cards.png');

    // Also get a screenshot of a GitHub card specifically if enriched
    const ghCard = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.wmn-card-found')];
      const gh = cards.find(c => c.querySelector('.dos-card-title')?.textContent?.includes('GitHub'));
      if (gh) {
        gh.scrollIntoView({ behavior: 'instant', block: 'center' });
        const r = gh.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }
      // fallback: first found card
      const first = cards[0];
      if (first) {
        first.scrollIntoView({ behavior: 'instant', block: 'center' });
        const r = first.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }
      return null;
    });
    await new Promise(r => setTimeout(r, 400));
    if (ghCard) {
      await page.screenshot({
        path: 'screenshot_enriched_card.png',
        clip: { x: Math.max(0, ghCard.x - 10), y: Math.max(0, ghCard.y - 10),
                width: ghCard.w + 20, height: ghCard.h + 20 }
      });
      console.log('Saved: screenshot_enriched_card.png');
    }
  }

  // Dump card info
  const info = await page.evaluate(() => {
    const wmnGrid = document.querySelector('.wmn-cards-grid');
    const wmnCards = document.querySelectorAll('.wmn-site-card');
    const foundCards = document.querySelectorAll('.wmn-card-found');
    const pendingCards = document.querySelectorAll('.wmn-card-pending');
    const enrichedCards = [...foundCards].filter(c => c.querySelectorAll('.dos-irow').length > 3);
    // Show data for first 5 enriched cards
    const enrichedSamples = enrichedCards.slice(0, 5).map(c => {
      const title = c.querySelector('.dos-card-title')?.textContent;
      const irows = [...c.querySelectorAll('.dos-irow')].map(r => r.textContent.trim());
      const hasPhoto = !!c.querySelector('.dos-card-photo');
      return { title, fields: irows, hasPhoto };
    });
    return {
      wmnGridExists: !!wmnGrid,
      totalWmnCards: wmnCards.length,
      foundCards: foundCards.length,
      enrichedCardCount: enrichedCards.length,
      hasSearch: !!document.querySelector('.wmn-card-search'),
      enrichedSamples,
    };
  });

  console.log('\n=== RENDER AUDIT ===');
  console.log(JSON.stringify(info, null, 2));

  await browser.close();
  console.log('\nDone.');
})();

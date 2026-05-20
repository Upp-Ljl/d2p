import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
await p.goto('http://127.0.0.1:8181/');
await p.waitForLoadState('domcontentloaded');
await p.waitForTimeout(3000);

const sections = [
  ['top', 0],
  ['#shift', 200],
  ['#live', 200],
  ['#overnight', 200],
  ['#gates', 200],
  ['#rollback', 200],
  ['#sworn', 200],
  ['#download', 200],
];

for (const [sel, off] of sections) {
  if (sel === 'top') {
    await p.evaluate(() => window.scrollTo(0, 0));
  } else {
    await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), sel);
  }
  await p.waitForTimeout(1300);
  const name = sel.replace('#', '');
  await p.screenshot({ path: `test-results/v3-${name}.png` });
  console.log('  shot', sel);
}

if (errs.length) {
  console.log('\nerrors:');
  for (const e of errs) console.log('  -', e);
}
await browser.close();

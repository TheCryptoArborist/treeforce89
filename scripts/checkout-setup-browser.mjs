/** Inspect the actual hosted game and retired setup route. No installed wallet or transaction signing. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium} = createRequire(process.env.PLAYWRIGHT_TEST_PACKAGE)('playwright');
const origin = 'https://deploy-preview-3--treeforce89.netlify.app';
const browser = await chromium.launch({headless: true});
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(origin + '/checkout-setup', {waitUntil: 'networkidle', timeout: 60000});
  assert.equal(response.status(), 200);
  assert.equal(new URL(page.url()).pathname, '/');
  await page.locator('.game-frame').waitFor();
  for (const width of [320, 390, 1200]) {
    await page.setViewportSize({width, height: 950});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.getByRole('button', {name: /Publish.*checkout/i}).count(), 0);
    assert.equal(await page.getByText('Publish TREE checkout', {exact: true}).count(), 0);
    console.log('TRANSFER_BROWSER_CHECK', width, 'game ready; no publication setup');
  }
  assert.deepEqual(errors, []);
  console.log('TRANSFER_BROWSER_RESULT', JSON.stringify({viewportWidths: [320, 390, 1200], pageErrors: 0, installedWallet: false, transactionsSigned: 0}));
} finally {await browser.close();}

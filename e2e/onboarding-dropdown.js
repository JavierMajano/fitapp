/**
 * FitApp E2E — Onboarding Unit Dropdown Visual Bug
 * Navigates to the measurements step and opens the inches/cm dropdown to capture the visual bug.
 *
 * Run: node e2e/onboarding-dropdown.js
 * Requires: npm install playwright
 */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.E2E_URL || 'http://localhost:8082';
const SHOT_DIR = path.resolve(__dirname, '../playwright-report/screenshots');

fs.mkdirSync(SHOT_DIR, { recursive: true });

async function shot(page, label) {
  const filename = label + '.png';
  const full = path.join(SHOT_DIR, filename);
  await page.screenshot({ path: full, fullPage: false });
  console.log('  📸 ' + filename);
  return full;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone 14 size

  // Inject token but NOT onboarded — so the app routes to onboarding
  await ctx.addInitScript(function () {
    localStorage.setItem('fitapp_auth_token', 'dev-bypass-token');
    localStorage.setItem('fitapp_onboarded', 'false');
  });

  const page = await ctx.newPage();

  console.log('→ Loading app…');
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, 'drop-01-initial');

  // Navigate directly to onboarding route
  console.log('→ Navigating to /onboarding…');
  await page.goto(TARGET_URL + '/onboarding', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1200);
  await shot(page, 'drop-02-onboarding-step0');

  // Step 0: Enter a name and proceed
  console.log('→ Entering name…');
  const nameInput = page.locator('input').first();
  await nameInput.fill('Test User');
  await page.waitForTimeout(400);
  await shot(page, 'drop-03-name-filled');

  // Click the Continue / Next button
  const nextBtn = page.getByText(/continue|next/i).last();
  await nextBtn.click();
  await page.waitForTimeout(800);
  await shot(page, 'drop-04-step1-measurements');

  // Step 1: Measurements — open the unit dropdown
  console.log('→ Opening unit dropdown…');
  // The dropdown trigger contains the current label (e.g. "Metric  (kg / cm)")
  const dropdownTrigger = page.getByText(/metric|imperial/i).first();
  await dropdownTrigger.click();
  await page.waitForTimeout(500);
  await shot(page, 'drop-05-dropdown-open');

  // Check if dropdown options are visible
  const imperialOption = page.getByText('Imperial  (lbs / in)');
  const isVisible = await imperialOption.isVisible().catch(() => false);
  console.log('  Imperial option visible:', isVisible);

  if (isVisible) {
    // Click Imperial to switch units
    console.log('→ Selecting Imperial…');
    await imperialOption.click();
    await page.waitForTimeout(500);
    await shot(page, 'drop-06-switched-to-imperial');

    // Reopen dropdown to show metric option
    await dropdownTrigger.click();
    await page.waitForTimeout(400);
    await shot(page, 'drop-07-dropdown-reopened');
  } else {
    console.log('  ⚠️  Dropdown options not visible — this is the bug!');
  }

  await browser.close();
  console.log('\nScreenshots saved to playwright-report/screenshots/');
})();

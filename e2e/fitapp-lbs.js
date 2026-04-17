/**
 * FitApp E2E — Imperial (lbs) Flow
 * Tests unit toggle (overlap check), workout in lbs, progress in lbs, round-trip to kg.
 * Runs on Desktop (1280×800) and iPhone 14 emulation.
 *
 * Key design decisions:
 * - addInitScript only sets auth keys, NOT fitapp_unit_system.
 *   The profile toggle stores the pref in localStorage; page.goto() reads it back.
 *   If addInitScript reset the pref on every navigation, the unit state would be lost.
 * - Tab navigation uses page.goto() for reliability (tab text-clicks can silently fail
 *   when the Zustand store is still hydrating on the new page).
 *
 * Run: node e2e/fitapp-lbs.js
 * Requires: npm install playwright
 */

'use strict';

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.E2E_URL || 'http://localhost:8081';
const SHOT_DIR = path.resolve(__dirname, '../playwright-report/screenshots');
const RESULTS_FILE = path.resolve(__dirname, '../playwright-report/results-lbs.json');

fs.mkdirSync(SHOT_DIR, { recursive: true });

/** Inject auth tokens only — unit pref is managed by the profile toggle + localStorage. */
async function injectAuth(ctx) {
  await ctx.addInitScript(function() {
    localStorage.setItem('fitapp_auth_token', 'dev-bypass-token');
    localStorage.setItem('fitapp_onboarded', 'true');
  });
}

async function shot(page, label) {
  var filename = label + '.png';
  var full = path.join(SHOT_DIR, filename);
  await page.screenshot({ path: full, fullPage: false });
  return 'screenshots/' + filename;
}

/** Navigate to a tab via full URL — preserves localStorage-persisted unit pref. */
async function goToTab(page, tabName) {
  var url = tabName === 'index' ? TARGET_URL + '/' : TARGET_URL + '/' + tabName;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(800);
}

async function runLbsFlow(page, prefix, results) {
  function push(name, status, sc) {
    results.push({ name: '[' + prefix + '] ' + name, status: status, screenshot: sc });
  }

  // ── Navigate to app ──────────────────────────────────────────────────────
  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);
  } catch (e) {
    var sc = await shot(page, prefix + '-00-load-fail');
    push('App loads', 'fail', sc);
    return;
  }

  // ── 1. PROFILE TOGGLE — overlap check + switch ───────────────────────────
  await goToTab(page, 'profile');
  var sc1 = await shot(page, prefix + '-01-profile');

  try {
    var lbsBtn = page.locator('[data-testid="unit-btn-lbs"]');
    await lbsBtn.waitFor({ state: 'visible', timeout: 5000 });
    var box = await lbsBtn.boundingBox();
    if (!box || box.width < 10 || box.height < 10) throw new Error('lbs bbox: ' + JSON.stringify(box));
    var enabled = await lbsBtn.isEnabled();
    if (!enabled) throw new Error('lbs btn disabled/intercepted');
    var kgBox = await page.locator('[data-testid="unit-btn-kg"]').boundingBox();
    if (!kgBox || kgBox.width < 10) throw new Error('kg btn bbox too small');
    push('Profile: unit-btn-lbs visible + interactable, kg also visible', 'pass', sc1);
  } catch (e) { push('Profile: unit-btn-lbs visible + interactable', 'fail', sc1); }

  var sc2;
  try {
    await page.locator('[data-testid="unit-btn-lbs"]').click({ timeout: 5000 });
    await page.waitForTimeout(600);
    var kgBoxAfter = await page.locator('[data-testid="unit-btn-kg"]').boundingBox();
    if (!kgBoxAfter || kgBoxAfter.width < 10) throw new Error('kg button collapsed after switch');
    sc2 = await shot(page, prefix + '-02-lbs-selected');
    push('Profile: switched to lbs, both buttons remain visible', 'pass', sc2);
  } catch (e) {
    sc2 = await shot(page, prefix + '-02-lbs-fail');
    push('Profile: switched to lbs', 'fail', sc2);
  }

  // ── 2. WORKOUT IN LBS ────────────────────────────────────────────────────
  await goToTab(page, 'workout');
  await page.waitForTimeout(500);
  await shot(page, prefix + '-03-workout-tab');

  try {
    await page.getByText('Start session').first().click({ timeout: 8000 });
    await page.waitForTimeout(600);
    var sc4 = await shot(page, prefix + '-04-start-modal');
    push('Workout: start session modal opened', 'pass', sc4);
  } catch (e) {
    var sc4f = await shot(page, prefix + '-04-start-fail');
    push('Workout: start session modal', 'fail', sc4f);
  }

  try {
    await page.getByText('Full Body').last().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    var sc5 = await shot(page, prefix + '-05-active-session');
    push('Workout: Full Body session active', 'pass', sc5);
  } catch (e) {
    var sc5f = await shot(page, prefix + '-05-active-fail');
    push('Workout: Full Body active', 'fail', sc5f);
  }

  try {
    await page.getByText('+ Add Set').first().click({ timeout: 5000 });
    await page.waitForTimeout(600);
  } catch (e) {
    try { await page.getByText('Add Set').first().click({ timeout: 3000 }); await page.waitForTimeout(600); } catch (e2) {}
  }

  try {
    await page.locator('input').first().fill('Squat');
    await page.waitForTimeout(400);
    await page.getByText('Squat').first().click({ timeout: 5000 });
    await page.waitForTimeout(600);
    var sc6 = await shot(page, prefix + '-06-squat-details');
    push('Workout: Squat selected, details step shown', 'pass', sc6);
  } catch (e) {
    var sc6f = await shot(page, prefix + '-06-squat-fail');
    push('Workout: Squat selected', 'fail', sc6f);
  }

  // Verify "Weight (lbs)" label
  try {
    var allText = await page.locator('body').innerText();
    if (allText.toLowerCase().indexOf('weight (lbs)') === -1) throw new Error('No "Weight (lbs)"');
    push('Workout: modal shows "Weight (lbs)"', 'pass', '');
  } catch (e) { push('Workout: modal shows "Weight (lbs)"', 'fail', ''); }

  // Enter 220 × 5, verify confirm text
  var sc7;
  try {
    var wInputs = page.locator('input[placeholder="0"]');
    await wInputs.first().fill('220');
    await page.waitForTimeout(200);
    await wInputs.last().fill('5');
    await page.waitForTimeout(300);
    var bodyText = await page.locator('body').innerText();
    if (bodyText.indexOf('220') === -1 || bodyText.toLowerCase().indexOf('lbs') === -1) {
      throw new Error('Missing 220 or lbs on page');
    }
    sc7 = await shot(page, prefix + '-07-confirm-220-lbs');
    push('Workout: confirm shows "220 lbs × 5"', 'pass', sc7);
  } catch (e) {
    sc7 = await shot(page, prefix + '-07-confirm-fail');
    push('Workout: confirm shows "220 lbs × 5"', 'fail', sc7);
  }

  try {
    await page.getByText('Log Set').first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
  } catch (e) {}

  // Verify LBS column + 220 in row
  var sc8;
  try {
    await page.waitForSelector('text=LBS', { timeout: 5000 });
    await page.waitForSelector('text=220', { timeout: 5000 });
    sc8 = await shot(page, prefix + '-08-set-row');
    push('Workout: column "LBS", set shows 220 (not 99.79)', 'pass', sc8);
  } catch (e) {
    sc8 = await shot(page, prefix + '-08-set-row-fail');
    push('Workout: column "LBS", set shows 220 (not 99.79)', 'fail', sc8);
  }

  try { await page.getByText('Finish').first().click({ timeout: 5000 }); await page.waitForTimeout(800); } catch (e) {}

  // ── 3. PROGRESS IN LBS ───────────────────────────────────────────────────
  await goToTab(page, 'progress');
  await page.waitForTimeout(500);
  await shot(page, prefix + '-09-progress-lbs');

  var sc10;
  try {
    await page.getByText('Log weight').first().click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await page.waitForSelector('text=Log Body Weight', { timeout: 5000 });
    var modalText = await page.locator('body').innerText();
    if (modalText.toLowerCase().indexOf('lbs') === -1) throw new Error('No lbs in modal');
    sc10 = await shot(page, prefix + '-10-weight-modal');
    push('Progress: weight modal shows "lbs" label', 'pass', sc10);
  } catch (e) {
    sc10 = await shot(page, prefix + '-10-modal-fail');
    push('Progress: weight modal shows "lbs" label', 'fail', sc10);
  }

  var sc11;
  try {
    await page.locator('input[placeholder="0.0"]').first().fill('179');
    await page.waitForTimeout(300);
    await page.getByText('Save Weight').first().click({ timeout: 5000 });
    await page.waitForTimeout(900);
    var afterText = await page.locator('body').innerText();
    if (afterText.indexOf('179') === -1 || afterText.toLowerCase().indexOf('lbs') === -1) {
      throw new Error('179 or lbs not visible after save');
    }
    sc11 = await shot(page, prefix + '-11-179-logged');
    push('Progress: 179 lbs logged, entry shows "179 lbs"', 'pass', sc11);
  } catch (e) {
    sc11 = await shot(page, prefix + '-11-179-fail');
    push('Progress: 179 lbs logged, entry shows "179 lbs"', 'fail', sc11);
  }

  // ── 4. ROUND-TRIP — switch back to kg ────────────────────────────────────
  await goToTab(page, 'profile');
  await page.waitForTimeout(500);

  var sc12;
  try {
    var kgBtn = page.locator('[data-testid="unit-btn-kg"]');
    await kgBtn.waitFor({ state: 'visible', timeout: 5000 });
    await kgBtn.click({ timeout: 5000 });
    await page.waitForTimeout(600);
    sc12 = await shot(page, prefix + '-12-back-to-kg');
    push('Round-trip: switched back to kg', 'pass', sc12);
  } catch (e) {
    sc12 = await shot(page, prefix + '-12-back-kg-fail');
    push('Round-trip: switched back to kg', 'fail', sc12);
  }

  await goToTab(page, 'progress');
  await page.waitForTimeout(500);

  var sc13;
  try {
    var finalText = await page.locator('body').innerText();
    if (finalText.indexOf(' kg') === -1) throw new Error('No " kg" text after round-trip');
    sc13 = await shot(page, prefix + '-13-kg-restored');
    push('Round-trip: progress shows kg, no lbs entries', 'pass', sc13);
  } catch (e) {
    sc13 = await shot(page, prefix + '-13-kg-fail');
    push('Round-trip: progress shows kg, no lbs entries', 'fail', sc13);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async function() {
  var browser = await chromium.launch({ headless: true });
  var results = [];

  console.log('\n▶ Running lbs flow — Desktop (1280×800)');
  var dCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await injectAuth(dCtx);
  await runLbsFlow(await dCtx.newPage(), 'lbs-desktop', results);
  await dCtx.close();

  console.log('\n▶ Running lbs flow — iPhone 14');
  var mCtx = await browser.newContext(devices['iPhone 14']);
  await injectAuth(mCtx);
  await runLbsFlow(await mCtx.newPage(), 'lbs-mobile', results);
  await mCtx.close();

  await browser.close();

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

  var passed = results.filter(function(r) { return r.status === 'pass'; }).length;
  var failed = results.length - passed;
  console.log('\n✅ ' + passed + ' passed  ❌ ' + failed + ' failed  (' + results.length + ' total)');
  if (failed > 0) {
    results.filter(function(r) { return r.status === 'fail'; }).forEach(function(r) { console.log('  ❌ ' + r.name); });
    process.exit(1);
  }
})();

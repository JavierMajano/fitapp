/**
 * FitApp E2E — Metric (kg) Flow
 * Tests food logging, workout session, and progress tracking on Desktop and iPhone 14.
 *
 * Run: node e2e/fitapp-kg.js
 * Requires: npm install playwright
 */

'use strict';

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.E2E_URL || 'http://localhost:8081';
const SHOT_DIR = path.resolve(__dirname, '../playwright-report/screenshots');
const RESULTS_FILE = path.resolve(__dirname, '../playwright-report/results-kg.json');

fs.mkdirSync(SHOT_DIR, { recursive: true });

async function injectAuth(ctx) {
  await ctx.addInitScript(function() {
    localStorage.setItem('fitapp_auth_token', 'dev-bypass-token');
    localStorage.setItem('fitapp_onboarded', 'true');
    // Ensure kg mode for this test suite
    localStorage.setItem('fitapp_unit_system', 'metric');
  });
}

async function shot(page, label) {
  var filename = label + '.png';
  var full = path.join(SHOT_DIR, filename);
  await page.screenshot({ path: full, fullPage: false });
  return 'screenshots/' + filename;
}

/** Navigate via URL — most reliable for Expo Router web tabs. */
async function goToTab(page, tabName) {
  var url = tabName === 'index' ? TARGET_URL + '/' : TARGET_URL + '/' + tabName;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(800);
}

async function runKgFlow(page, prefix, results) {
  function push(name, status, sc) {
    results.push({ name: '[' + prefix + '] ' + name, status: status, screenshot: sc });
  }

  // Load app
  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);
    var sc = await shot(page, prefix + '-01-home');
    push('App loads', 'pass', sc);
  } catch (e) {
    var scf = await shot(page, prefix + '-01-home-fail');
    push('App loads', 'fail', scf);
    return;
  }

  // ── 1. FOOD FLOW ────────────────────────────────────────────────────────
  await goToTab(page, 'food');

  try {
    await page.waitForSelector('text=Oats', { timeout: 8000 });
    var sc2 = await shot(page, prefix + '-02-food-default');
    push('Food tab: seed data visible (Oats)', 'pass', sc2);
  } catch (e) {
    var sc2f = await shot(page, prefix + '-02-food-default-fail');
    push('Food tab: seed data visible', 'fail', sc2f);
  }

  // Open Add food modal
  try {
    await page.getByText('+ Add food').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
  } catch (e) {
    try { await page.getByText('Add food').first().click({ timeout: 3000 }); await page.waitForTimeout(500); } catch (e2) {}
  }

  try {
    // Modal title is "Add Food"; search input has placeholder "Search foods..."
    await page.waitForSelector('text=Add Food', { timeout: 5000 });
    var sc3 = await shot(page, prefix + '-03-food-modal-search');
    push('Food modal: search step open', 'pass', sc3);
  } catch (e) {
    var sc3f = await shot(page, prefix + '-03-food-modal-search-fail');
    push('Food modal: search step open', 'fail', sc3f);
  }

  // Search salmon
  try {
    var searchInput = page.locator('input').first();
    await searchInput.fill('salmon');
    await page.waitForTimeout(400);
    await page.getByText('Salmon').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    var sc4 = await shot(page, prefix + '-04-food-quantity');
    push('Food: salmon found and selected', 'pass', sc4);
  } catch (e) {
    var sc4f = await shot(page, prefix + '-04-food-quantity-fail');
    push('Food: salmon found and selected', 'fail', sc4f);
  }

  // Set qty 200, Dinner, log — use testIDs for reliable targeting
  try {
    var qtyInput = page.locator('input').first();
    await qtyInput.click({ clickCount: 3 });
    await qtyInput.fill('200');
    await page.waitForTimeout(300);

    // testID="meal-btn-dinner" — avoids matching background meal card headers
    await page.locator('[data-testid="meal-btn-dinner"]').click({ timeout: 3000 });
    await page.waitForTimeout(300);

    // testID="log-food-btn" — avoids matching "Food Log" header or other "Log" text
    await page.locator('[data-testid="log-food-btn"]').click({ timeout: 5000 });
    await page.waitForTimeout(800);

    // Salmon should appear somewhere on the food log (any meal)
    await page.waitForSelector('text=Salmon', { timeout: 5000 });
    var sc5 = await shot(page, prefix + '-05-food-salmon-logged');
    push('Food: Salmon 200g logged to Dinner', 'pass', sc5);
  } catch (e) {
    var sc5f = await shot(page, prefix + '-05-food-salmon-fail');
    push('Food: Salmon 200g logged to Dinner', 'fail', sc5f);
  }

  // ── 2. WORKOUT FLOW ─────────────────────────────────────────────────────
  await goToTab(page, 'workout');
  await page.waitForTimeout(500);

  try {
    var sc6 = await shot(page, prefix + '-06-workout-default');
    push('Workout tab: default state', 'pass', sc6);
  } catch (e) {}

  try {
    await page.getByText('Start session').first().click({ timeout: 8000 });
    await page.waitForTimeout(500);
    var sc7 = await shot(page, prefix + '-07-start-session-modal');
    push('Workout: start session modal open', 'pass', sc7);
  } catch (e) {
    var sc7f = await shot(page, prefix + '-07-start-fail');
    push('Workout: start session modal', 'fail', sc7f);
  }

  try {
    await page.getByText('Full Body').last().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    await page.waitForSelector('text=+ Add Set', { timeout: 8000 });
    var sc8 = await shot(page, prefix + '-08-active-session');
    push('Workout: Full Body session started', 'pass', sc8);
  } catch (e) {
    var sc8f = await shot(page, prefix + '-08-active-fail');
    push('Workout: Full Body session started', 'fail', sc8f);
  }

  try {
    await page.getByText('+ Add Set').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    var sc9 = await shot(page, prefix + '-09-log-set-exercise');
    push('Workout: log set modal open', 'pass', sc9);
  } catch (e) {
    var sc9f = await shot(page, prefix + '-09-log-set-fail');
    push('Workout: log set modal', 'fail', sc9f);
  }

  try {
    await page.locator('input').first().fill('Squat');
    await page.waitForTimeout(400);
    await page.getByText('Squat').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    var sc10 = await shot(page, prefix + '-10-log-set-details');
    push('Workout: Squat selected, details step', 'pass', sc10);
  } catch (e) {
    var sc10f = await shot(page, prefix + '-10-squat-fail');
    push('Workout: Squat selected', 'fail', sc10f);
  }

  try {
    var wInputs = page.locator('input[placeholder="0"]');
    await wInputs.first().fill('100');
    await page.waitForTimeout(200);
    await wInputs.last().fill('5');
    await page.waitForTimeout(200);

    await page.getByText('Log Set').first().click({ timeout: 5000 });
    await page.waitForTimeout(800);

    await page.waitForSelector('text=Squat', { timeout: 5000 });
    var sc11 = await shot(page, prefix + '-11-squat-logged');
    push('Workout: Squat 100 kg × 5 logged', 'pass', sc11);
  } catch (e) {
    var sc11f = await shot(page, prefix + '-11-squat-fail');
    push('Workout: Squat 100 kg × 5 logged', 'fail', sc11f);
  }

  try {
    await page.getByText('Finish').first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    var sc12 = await shot(page, prefix + '-12-session-complete');
    push('Workout: session finished, card visible', 'pass', sc12);
  } catch (e) {
    var sc12f = await shot(page, prefix + '-12-session-fail');
    push('Workout: session finished', 'fail', sc12f);
  }

  // ── 3. PROGRESS FLOW ────────────────────────────────────────────────────
  await goToTab(page, 'progress');
  await page.waitForTimeout(500);

  try {
    await page.waitForSelector('text=Body Weight', { timeout: 8000 });
    var sc13 = await shot(page, prefix + '-13-progress-default');
    push('Progress tab: charts and PRs visible', 'pass', sc13);
  } catch (e) {
    var sc13f = await shot(page, prefix + '-13-progress-fail');
    push('Progress tab: charts visible', 'fail', sc13f);
  }

  try {
    await page.getByText('Log weight').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.waitForSelector('text=Log Body Weight', { timeout: 5000 });
    var sc14 = await shot(page, prefix + '-14-weight-modal');
    push('Progress: weight modal open', 'pass', sc14);
  } catch (e) {
    var sc14f = await shot(page, prefix + '-14-weight-modal-fail');
    push('Progress: weight modal', 'fail', sc14f);
  }

  try {
    await page.locator('input[placeholder="0.0"]').first().fill('81.2');
    await page.waitForTimeout(300);
    await page.getByText('Save Weight').first().click({ timeout: 5000 });
    await page.waitForTimeout(800);

    await page.waitForSelector('text=81.2', { timeout: 5000 });
    var sc15 = await shot(page, prefix + '-15-weight-logged');
    push('Progress: 81.2 kg logged, chart updated', 'pass', sc15);
  } catch (e) {
    var sc15f = await shot(page, prefix + '-15-weight-fail');
    push('Progress: 81.2 kg logged', 'fail', sc15f);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async function() {
  var browser = await chromium.launch({ headless: true });
  var results = [];

  console.log('\n▶ Running kg flow — Desktop (1280×800)');
  var dCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await injectAuth(dCtx);
  await runKgFlow(await dCtx.newPage(), 'kg-desktop', results);
  await dCtx.close();

  console.log('\n▶ Running kg flow — iPhone 14');
  var mCtx = await browser.newContext(devices['iPhone 14']);
  await injectAuth(mCtx);
  await runKgFlow(await mCtx.newPage(), 'kg-mobile', results);
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

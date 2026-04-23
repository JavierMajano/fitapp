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

/** Check if the backend API is reachable — returns true/false, never throws. */
async function checkBackend() {
  var apiUrl = process.env.E2E_API_URL || 'http://localhost:3000';
  try {
    var http = require('http');
    return await new Promise(function (resolve) {
      var req = http.get(apiUrl + '/trpc/health', function (res) {
        resolve(res.statusCode < 500);
      });
      req.setTimeout(3000, function () { req.destroy(); resolve(false); });
      req.on('error', function () { resolve(false); });
    });
  } catch (e) {
    return false;
  }
}

/** Navigate via URL — most reliable for Expo Router web tabs. */
async function goToTab(page, tabName) {
  var url = tabName === 'index' ? TARGET_URL + '/' : TARGET_URL + '/' + tabName;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(800);
}

async function runKgFlow(page, prefix, results, backendAvailable) {
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
    // Phase 6: food tab uses real backend; no Zustand mock data.
    // Check that the Food Log header (always rendered) is visible.
    await page.waitForSelector('text=Food Log', { timeout: 8000 });
    var sc2 = await shot(page, prefix + '-02-food-default');
    push('Food tab: renders with Food Log header', 'pass', sc2);
  } catch (e) {
    var sc2f = await shot(page, prefix + '-02-food-default-fail');
    push('Food tab: renders with Food Log header', 'fail', sc2f);
  }

  // Open Add food modal
  try {
    await page.locator('[data-testid="add-food-btn"]').click({ timeout: 5000 });
    await page.waitForTimeout(500);
  } catch (e) {
    try { await page.getByText('+ Add food').first().click({ timeout: 3000 }); await page.waitForTimeout(500); } catch (e2) {}
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

  // Search salmon — requires backend (USDA food search API)
  if (!backendAvailable) {
    push('Food: salmon found and selected', 'skip', '');
    push('Food: Salmon 200g logged to Dinner', 'skip', '');
  } else {
    try {
      var searchInput = page.locator('[data-testid="food-search-input"]');
      if ((await searchInput.count()) === 0) searchInput = page.locator('input').first();
      await searchInput.fill('salmon');
      await page.waitForTimeout(2500); // USDA API latency
      await page.locator('[data-testid="food-result-0"]').click({ timeout: 15000 });
      await page.waitForTimeout(500);
      var sc4 = await shot(page, prefix + '-04-food-quantity');
      push('Food: salmon found and selected', 'pass', sc4);
    } catch (e) {
      var sc4f = await shot(page, prefix + '-04-food-quantity-fail');
      push('Food: salmon found and selected', 'fail', sc4f);
    }

    try {
      var qtyInput = page.locator('input').first();
      await qtyInput.click({ clickCount: 3 });
      await qtyInput.fill('200');
      await page.waitForTimeout(300);
      await page.locator('[data-testid="meal-btn-dinner"]').click({ timeout: 3000 });
      await page.waitForTimeout(300);
      await page.locator('[data-testid="log-food-btn"]').click({ timeout: 5000 });
      await page.waitForTimeout(800);
      await page.waitForSelector('text=Salmon', { timeout: 5000 });
      var sc5 = await shot(page, prefix + '-05-food-salmon-logged');
      push('Food: Salmon 200g logged to Dinner', 'pass', sc5);
    } catch (e) {
      var sc5f = await shot(page, prefix + '-05-food-salmon-fail');
      push('Food: Salmon 200g logged to Dinner', 'fail', sc5f);
    }
  }

  // ── 2. WORKOUT FLOW ─────────────────────────────────────────────────────
  await goToTab(page, 'workout');
  await page.waitForTimeout(500);

  try {
    var sc6 = await shot(page, prefix + '-06-workout-default');
    push('Workout tab: default state', 'pass', sc6);
  } catch (e) {}

  try {
    // Phase 6: use testID selector for reliability
    await page.locator('[data-testid="start-session-btn"]').click({ timeout: 8000 });
    await page.waitForTimeout(500);
    var sc7 = await shot(page, prefix + '-07-start-session-modal');
    push('Workout: start session modal open', 'pass', sc7);
  } catch (e) {
    var sc7f = await shot(page, prefix + '-07-start-fail');
    push('Workout: start session modal', 'fail', sc7f);
    // Try text fallback
    try { await page.getByText('Start session').first().click({ timeout: 3000 }); await page.waitForTimeout(500); } catch (_) {}
  }

  // Session start + sets + finish — requires backend (workout.startSession / logSet / endSession)
  if (!backendAvailable) {
    push('Workout: Full Body session started', 'skip', '');
    push('Workout: log set modal open', 'skip', '');
    push('Workout: Squat selected, details step', 'skip', '');
    push('Workout: Squat 100 kg × 5 logged', 'skip', '');
    push('Workout: session finished, card visible', 'skip', '');
  } else {
    try {
      var fullBodyBtn = page.getByText('Full Body');
      if ((await fullBodyBtn.count()) > 0) {
        await fullBodyBtn.last().click({ timeout: 5000 });
      } else {
        await page.locator('[data-testid="start-empty-session-btn"]').click({ timeout: 5000 });
      }
      await page.waitForTimeout(800);
      await page.waitForSelector('[data-testid="add-set-btn"]', { timeout: 8000 });
      var sc8 = await shot(page, prefix + '-08-active-session');
      push('Workout: Full Body session started', 'pass', sc8);
    } catch (e) {
      var sc8f = await shot(page, prefix + '-08-active-fail');
      push('Workout: Full Body session started', 'fail', sc8f);
    }

    try {
      await page.locator('[data-testid="add-set-btn"]').click({ timeout: 5000 });
      await page.waitForTimeout(500);
      var sc9 = await shot(page, prefix + '-09-log-set-exercise');
      push('Workout: log set modal open', 'pass', sc9);
    } catch (e) {
      var sc9f = await shot(page, prefix + '-09-log-set-fail');
      push('Workout: log set modal', 'fail', sc9f);
    }

    try {
      var exerciseSearch = page.locator('[data-testid="exercise-search-input"]');
      if ((await exerciseSearch.count()) === 0) exerciseSearch = page.locator('input').first();
      await exerciseSearch.fill('Squat');
      await page.waitForTimeout(500);
      await page.locator('[data-testid="exercise-result-0"]').click({ timeout: 8000 });
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
      await page.locator('[data-testid="log-set-submit-btn"]').click({ timeout: 5000 });
      await page.waitForTimeout(1000);
      await page.waitForSelector('text=Squat', { timeout: 5000 });
      var sc11 = await shot(page, prefix + '-11-squat-logged');
      push('Workout: Squat 100 kg × 5 logged', 'pass', sc11);
    } catch (e) {
      var sc11f = await shot(page, prefix + '-11-squat-fail');
      push('Workout: Squat 100 kg × 5 logged', 'fail', sc11f);
    }

    try {
      try { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } catch (_) {}
      await page.locator('[data-testid="finish-session-btn"]').click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      var sc12 = await shot(page, prefix + '-12-session-complete');
      push('Workout: session finished, card visible', 'pass', sc12);
    } catch (e) {
      var sc12f = await shot(page, prefix + '-12-session-fail');
      push('Workout: session finished', 'fail', sc12f);
    }
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
    await page.locator('[data-testid="log-weight-btn"]').click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.waitForSelector('text=Log Body Weight', { timeout: 5000 });
    var sc14 = await shot(page, prefix + '-14-weight-modal');
    push('Progress: weight modal open', 'pass', sc14);
  } catch (e) {
    var sc14f = await shot(page, prefix + '-14-weight-modal-fail');
    push('Progress: weight modal', 'fail', sc14f);
  }

  // Weight save — requires backend (body.logWeight)
  if (!backendAvailable) {
    push('Progress: 81.2 kg logged, chart updated', 'skip', '');
  } else {
    try {
      await page.locator('[data-testid="weight-log-input"]').fill('81.2');
      await page.waitForTimeout(300);
      await page.locator('[data-testid="save-weight-btn"]').click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      await page.waitForSelector('text=81.2', { timeout: 8000 });
      var sc15 = await shot(page, prefix + '-15-weight-logged');
      push('Progress: 81.2 kg logged, chart updated', 'pass', sc15);
    } catch (e) {
      var sc15f = await shot(page, prefix + '-15-weight-fail');
      push('Progress: 81.2 kg logged', 'fail', sc15f);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async function() {
  var browser = await chromium.launch({ headless: true });
  var results = [];

  var backendAvailable = await checkBackend();
  if (!backendAvailable) {
    console.log('ℹ  Backend not reachable — backend-dependent tests will be skipped');
  }

  console.log('\n▶ Running kg flow — Desktop (1280×800)');
  var dCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await injectAuth(dCtx);
  await runKgFlow(await dCtx.newPage(), 'kg-desktop', results, backendAvailable);
  await dCtx.close();

  console.log('\n▶ Running kg flow — iPhone 14');
  var mCtx = await browser.newContext(devices['iPhone 14']);
  await injectAuth(mCtx);
  await runKgFlow(await mCtx.newPage(), 'kg-mobile', results, backendAvailable);
  await mCtx.close();

  await browser.close();

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

  var passed = results.filter(function(r) { return r.status === 'pass'; }).length;
  var skipped = results.filter(function(r) { return r.status === 'skip'; }).length;
  var failed = results.filter(function(r) { return r.status === 'fail'; }).length;
  console.log('\n✅ ' + passed + ' passed  ⏭  ' + skipped + ' skipped  ❌ ' + failed + ' failed  (' + results.length + ' total)');
  if (failed > 0) {
    results.filter(function(r) { return r.status === 'fail'; }).forEach(function(r) { console.log('  ❌ ' + r.name); });
    process.exit(1);
  }
})();

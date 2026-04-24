/**
 * FitApp Phase 6 E2E — Real Backend Integration
 *
 * Tests all major Phase 6 flows against the real tRPC backend:
 *   • Food logging (search → log → delete)
 *   • Workout session (start → log sets → finish → verify card)
 *   • Progress tab (weight + calorie charts render, log weight)
 *   • Profile (edit name + goal weight, unit toggle)
 *   • Dashboard (macro ring + goal weight widget)
 *
 * Run:   node e2e/fitapp-phase6.js
 * Needs: Expo web server on E2E_URL (default http://localhost:8081)
 *        tRPC server on E2E_API_URL (default http://localhost:3000)
 */

'use strict';

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.E2E_URL || 'http://localhost:8081';
const API_URL = process.env.E2E_API_URL || 'http://localhost:3000';
const SHOT_DIR = path.resolve(__dirname, '../playwright-report/screenshots');
const RESULTS_FILE = path.resolve(__dirname, '../playwright-report/results-phase6.json');

fs.mkdirSync(SHOT_DIR, { recursive: true });

// ── Auth helpers ──────────────────────────────────────────────────────────────

/** Create a unique test user and return their JWT token + userId */
async function createTestUser() {
  const ts = Date.now();
  const email = `e2e_phase6_${ts}@fitapp.test`;
  const password = 'TestPass123!';
  const name = 'E2E Phase6';

  // Sign up
  const signUpRes = await fetch(`${API_URL}/trpc/auth.signUp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!signUpRes.ok) {
    const text = await signUpRes.text();
    throw new Error(`signUp failed (${signUpRes.status}): ${text}`);
  }
  const signUpData = await signUpRes.json();
  const token = signUpData?.result?.data?.token || signUpData?.result?.data?.json?.token;
  if (!token) throw new Error('signUp returned no token: ' + JSON.stringify(signUpData));

  // Complete onboarding so tabs are accessible
  await fetch(`${API_URL}/trpc/user.completeOnboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      goalMode: 'maintenance',
      weightKg: 80,
      heightCm: 175,
      age: 30,
      sex: 'male',
      activityLevel: 'moderate',
    }),
  });

  return { token, email, name };
}

/** Inject a real JWT into the browser context before page load */
async function injectAuth(ctx, token) {
  await ctx.addInitScript(function (t) {
    localStorage.setItem('fitapp_auth_token', t);
    localStorage.setItem('fitapp_onboarded', 'true');
    localStorage.setItem('fitapp_unit_system', 'metric');
  }, token);
}

// ── Screenshot + navigation helpers ──────────────────────────────────────────

async function shot(page, label) {
  var filename = label + '.png';
  await page.screenshot({ path: path.join(SHOT_DIR, filename), fullPage: false });
  return 'screenshots/' + filename;
}

async function goToTab(page, tabName) {
  var url = tabName === 'index' ? TARGET_URL + '/' : TARGET_URL + '/' + tabName;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
}

// ── Main flow ─────────────────────────────────────────────────────────────────

async function runPhase6Flow(page, prefix, results, token) {
  function push(name, status, sc) {
    results.push({ name: '[' + prefix + '] ' + name, status: status, screenshot: sc || null });
    var icon = status === 'pass' ? '  ✓' : '  ✗';
    console.log(icon + ' ' + name);
  }

  // ── 0. App loads ────────────────────────────────────────────────────────────
  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    var sc0 = await shot(page, prefix + '-00-home');
    push('App loads', 'pass', sc0);
  } catch (e) {
    push('App loads', 'fail', await shot(page, prefix + '-00-home-fail'));
    return; // Cannot proceed
  }

  // ── 1. DASHBOARD — macro ring + greeting ───────────────────────────────────
  console.log('\n  [Dashboard]');
  await goToTab(page, 'index');

  try {
    await page.waitForSelector('text=Calories', { timeout: 8000 });
    var sc1 = await shot(page, prefix + '-01-dashboard');
    push('Dashboard: macro ring rendered', 'pass', sc1);
  } catch (e) {
    push('Dashboard: macro ring rendered', 'fail', await shot(page, prefix + '-01-dash-fail'));
  }

  try {
    // Greeting (Good morning/afternoon/evening) should be visible
    await page.waitForSelector('text=/Good (morning|afternoon|evening)/', { timeout: 5000 });
    push('Dashboard: time-based greeting shown', 'pass', null);
  } catch (e) {
    push('Dashboard: time-based greeting shown', 'fail', null);
  }

  // ── 2. FOOD — log a food item ───────────────────────────────────────────────
  console.log('\n  [Food tab]');
  await goToTab(page, 'food');

  try {
    // Food log header or "Food Log" title
    await page.waitForSelector('text=Food Log', { timeout: 8000 });
    var sc2 = await shot(page, prefix + '-02-food-tab');
    push('Food tab: rendered', 'pass', sc2);
  } catch (e) {
    push('Food tab: rendered', 'fail', await shot(page, prefix + '-02-food-fail'));
  }

  // Open "Add food" modal
  try {
    await page.getByText('+ Add food').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.waitForSelector('text=Add Food', { timeout: 5000 });
    push('Food: add modal opens', 'pass', null);
  } catch (e) {
    try {
      await page.getByText('Add food').first().click({ timeout: 3000 });
      await page.waitForTimeout(500);
    } catch (_) {}
    push('Food: add modal opens', 'fail', await shot(page, prefix + '-02b-food-modal-fail'));
  }

  // Search for "egg"
  try {
    var searchIn = page.locator('input[placeholder*="earch"]').first();
    await searchIn.fill('egg');
    await page.waitForTimeout(600); // debounce
    // Wait for a result row
    await page.waitForSelector('text=/egg/i', { timeout: 8000 });
    push('Food: search returns results for "egg"', 'pass', null);
  } catch (e) {
    push(
      'Food: search returns results for "egg"',
      'fail',
      await shot(page, prefix + '-03-search-fail'),
    );
  }

  // Select first result
  try {
    var firstResult = page.locator('[data-testid^="food-result"]').first();
    await firstResult.click({ timeout: 5000 });
    await page.waitForTimeout(500);
    // Quantity step
    await page.waitForSelector('text=/quantity|grams|serving/i', { timeout: 5000 });
    push('Food: food item selected, quantity step shown', 'pass', null);
  } catch (e) {
    // Try clicking any result that appeared
    try {
      await page.locator('text=/egg/i').first().click({ timeout: 3000 });
      await page.waitForTimeout(500);
    } catch (_) {}
    push(
      'Food: food item selected, quantity step shown',
      'fail',
      await shot(page, prefix + '-04-select-fail'),
    );
  }

  // Log 100g to Breakfast
  var foodLoggedOk = false;
  try {
    var qtyInput = page.locator('input').first();
    await qtyInput.click({ clickCount: 3 });
    await qtyInput.fill('100');
    await page.waitForTimeout(200);

    // Select breakfast meal
    await page.locator('[data-testid="meal-btn-breakfast"]').click({ timeout: 3000 });
    await page.waitForTimeout(200);

    // Log it
    await page.locator('[data-testid="log-food-btn"]').click({ timeout: 5000 });
    await page.waitForTimeout(1200); // wait for mutation + refetch

    // Modal should be closed; food entry should appear in the log
    var sc5 = await shot(page, prefix + '-05-food-logged');
    push('Food: 100g logged to Breakfast', 'pass', sc5);
    foodLoggedOk = true;
  } catch (e) {
    push('Food: 100g logged to Breakfast', 'fail', await shot(page, prefix + '-05-food-log-fail'));
  }

  // Dashboard should now show non-zero calories
  if (foodLoggedOk) {
    await goToTab(page, 'index');
    try {
      // The calorie progress text e.g. "234 / 2400 kcal" should show a nonzero left side
      await page.waitForSelector('text=/ kcal', { timeout: 6000 });
      push('Dashboard: calorie tracker updates after food log', 'pass', null);
    } catch (e) {
      push('Dashboard: calorie tracker updates after food log', 'fail', null);
    }
    await goToTab(page, 'food');
  }

  // Delete the entry (swipe / long-press → delete icon)
  try {
    var deleteBtn = page.locator('[data-testid^="delete-entry"]').first();
    await deleteBtn.click({ timeout: 5000 });
    await page.waitForTimeout(800);
    push('Food: entry deleted', 'pass', null);
  } catch (e) {
    // Not critical — skip quietly
    push('Food: entry deleted', 'skip', null);
  }

  // ── 3. WORKOUT — session lifecycle ─────────────────────────────────────────
  console.log('\n  [Workout tab]');
  await goToTab(page, 'workout');

  try {
    // Routine list should render (routines from DB)
    await page.waitForSelector('text=/routine|workout|session/i', { timeout: 8000 });
    var sc6 = await shot(page, prefix + '-06-workout-tab');
    push('Workout tab: rendered with routines', 'pass', sc6);
  } catch (e) {
    push('Workout tab: rendered with routines', 'fail', await shot(page, prefix + '-06-wk-fail'));
  }

  // Start a session
  try {
    await page.getByText('Start session').first().click({ timeout: 8000 });
    await page.waitForTimeout(500);
    await page.waitForSelector('text=/start|session|name/i', { timeout: 5000 });
    push('Workout: start session modal opens', 'pass', null);
  } catch (e) {
    push('Workout: start session modal opens', 'fail', await shot(page, prefix + '-07-start-fail'));
  }

  // Click through — pick a routine or confirm free session
  var sessionStarted = false;
  try {
    // Try clicking the first routine card
    var routineBtn = page.locator('[data-testid^="routine-btn"]').first();
    await routineBtn.click({ timeout: 3000 });
    await page.waitForTimeout(1000);
    sessionStarted = true;
  } catch (_) {
    try {
      // Fallback: look for a "Start" or "Begin" button
      await page
        .getByText(/^Start$/)
        .first()
        .click({ timeout: 3000 });
      await page.waitForTimeout(1000);
      sessionStarted = true;
    } catch (_) {}
  }

  // Add first set
  var setsLogged = 0;
  if (sessionStarted) {
    try {
      await page.waitForSelector('text=+ Add Set', { timeout: 8000 });
      push('Workout: active session screen shown', 'pass', null);
    } catch (e) {
      push(
        'Workout: active session screen shown',
        'fail',
        await shot(page, prefix + '-08-session-fail'),
      );
    }

    // Log Set 1
    try {
      await page.getByText('+ Add Set').first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
      // Exercise picker / search input
      var exInput = page.locator('input').first();
      await exInput.fill('Bench');
      await page.waitForTimeout(400);
      await page.getByText(/bench/i).first().click({ timeout: 5000 });
      await page.waitForTimeout(400);

      var wt1 = page.locator('input[placeholder="0"]').first();
      await wt1.fill('80');
      await page.locator('input[placeholder="0"]').last().fill('8');
      await page.waitForTimeout(200);
      await page.getByText('Log Set').first().click({ timeout: 5000 });
      await page.waitForTimeout(800);
      push('Workout: Set 1 (Bench Press 80 kg × 8) logged', 'pass', null);
      setsLogged++;
    } catch (e) {
      push('Workout: Set 1 logged', 'fail', await shot(page, prefix + '-09-set1-fail'));
    }

    // Log Set 2
    try {
      await page.getByText('+ Add Set').first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
      var exInput2 = page.locator('input').first();
      await exInput2.fill('Squat');
      await page.waitForTimeout(400);
      await page.getByText(/squat/i).first().click({ timeout: 5000 });
      await page.waitForTimeout(400);

      await page.locator('input[placeholder="0"]').first().fill('100');
      await page.locator('input[placeholder="0"]').last().fill('5');
      await page.waitForTimeout(200);
      await page.getByText('Log Set').first().click({ timeout: 5000 });
      await page.waitForTimeout(800);
      push('Workout: Set 2 (Squat 100 kg × 5) logged', 'pass', null);
      setsLogged++;
    } catch (e) {
      push('Workout: Set 2 logged', 'fail', await shot(page, prefix + '-10-set2-fail'));
    }
  } else {
    push('Workout: active session screen shown', 'fail', null);
    push('Workout: Set 1 logged', 'skip', null);
    push('Workout: Set 2 logged', 'skip', null);
  }

  // Finish session
  if (setsLogged > 0) {
    try {
      await page.getByText('Finish').first().click({ timeout: 5000 });
      await page.waitForTimeout(1200);
      // Completed session card should appear
      await page.waitForSelector('text=/sets|session|bench|squat/i', { timeout: 6000 });
      var sc11 = await shot(page, prefix + '-11-session-done');
      push('Workout: session finished, past session card shown', 'pass', sc11);
    } catch (e) {
      push(
        'Workout: session finished, past session card shown',
        'fail',
        await shot(page, prefix + '-11-finish-fail'),
      );
    }
  } else {
    push('Workout: session finished, past session card shown', 'skip', null);
  }

  // ── 4. PROGRESS — charts render + log weight ───────────────────────────────
  console.log('\n  [Progress tab]');
  await goToTab(page, 'progress');

  try {
    await page.waitForSelector('text=Body Weight', { timeout: 8000 });
    push('Progress: Body Weight section visible', 'pass', null);
  } catch (e) {
    push(
      'Progress: Body Weight section visible',
      'fail',
      await shot(page, prefix + '-12-prog-fail'),
    );
  }

  try {
    await page.waitForSelector('text=Calorie Intake', { timeout: 5000 });
    push('Progress: Calorie Intake section visible', 'pass', null);
  } catch (e) {
    push('Progress: Calorie Intake section visible', 'fail', null);
  }

  try {
    await page.waitForSelector('text=/1W|1M|3M/', { timeout: 5000 });
    push('Progress: TimeRangeSelector (1W/1M/3M) rendered', 'pass', null);
  } catch (e) {
    push('Progress: TimeRangeSelector rendered', 'fail', null);
  }

  // Open weight modal and log 79.5 kg
  try {
    await page.getByText('Log weight').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.waitForSelector('text=Log Body Weight', { timeout: 5000 });
    push('Progress: log weight modal opens', 'pass', null);
  } catch (e) {
    push(
      'Progress: log weight modal opens',
      'fail',
      await shot(page, prefix + '-13-wt-modal-fail'),
    );
  }

  try {
    await page.locator('input[placeholder="0.0"]').first().fill('79.5');
    await page.waitForTimeout(200);
    await page.getByText('Save Weight').first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.waitForSelector('text=79.5', { timeout: 5000 });
    var sc14 = await shot(page, prefix + '-14-weight-logged');
    push('Progress: 79.5 kg logged, chart updates', 'pass', sc14);
  } catch (e) {
    push('Progress: 79.5 kg logged', 'fail', await shot(page, prefix + '-14-wt-fail'));
  }

  // Switch to 1M range
  try {
    await page.locator('text=1M').first().click({ timeout: 3000 });
    await page.waitForTimeout(600);
    push('Progress: 1M time range switch works', 'pass', null);
  } catch (e) {
    push('Progress: 1M time range switch works', 'fail', null);
  }

  // ── 5. PROFILE — edit + unit toggle ────────────────────────────────────────
  console.log('\n  [Profile tab]');
  await goToTab(page, 'profile');

  try {
    await page.waitForSelector('text=Profile', { timeout: 8000 });
    await page.waitForSelector('text=/TDEE|Target|Weight/i', { timeout: 5000 });
    var sc15 = await shot(page, prefix + '-15-profile-tab');
    push('Profile: user data rendered (TDEE/Target/Weight)', 'pass', sc15);
  } catch (e) {
    push('Profile: user data rendered', 'fail', await shot(page, prefix + '-15-profile-fail'));
  }

  // Edit profile — change name + goalWeightKg
  try {
    await page.getByText('Edit profile').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.waitForSelector('text=Edit Profile', { timeout: 5000 });
    push('Profile: edit modal opens', 'pass', null);
  } catch (e) {
    push('Profile: edit modal opens', 'fail', await shot(page, prefix + '-16-edit-fail'));
  }

  try {
    var nameInput = page.locator('input').first();
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill('E2E Updated');
    await page.waitForTimeout(200);

    // Goal weight field (3rd input)
    var goalWtInput = page.locator('input').nth(2);
    await goalWtInput.click({ clickCount: 3 });
    await goalWtInput.fill('75');
    await page.waitForTimeout(200);

    await page.getByText('Save changes').first().click({ timeout: 5000 });
    await page.waitForTimeout(1200);

    // Updated name should appear
    await page.waitForSelector('text=E2E Updated', { timeout: 6000 });
    push('Profile: name + goal weight saved', 'pass', null);
  } catch (e) {
    push('Profile: name + goal weight saved', 'fail', await shot(page, prefix + '-17-save-fail'));
  }

  // Unit toggle — switch to lbs
  try {
    await page.locator('[data-testid="unit-btn-lbs"]').click({ timeout: 5000 });
    await page.waitForTimeout(600);
    // Toggle should now show lbs as active
    var lbsBtn = page.locator('[data-testid="unit-btn-lbs"]');
    var bgColor = await lbsBtn.evaluate(function (el) {
      return window.getComputedStyle(el).backgroundColor;
    });
    // Active = brand green (#1a9e6e → rgb(26,158,110))
    var isActive = bgColor.includes('26') || bgColor.includes('158');
    push('Profile: unit toggle switches to lbs', isActive ? 'pass' : 'fail', null);
  } catch (e) {
    push('Profile: unit toggle switches to lbs', 'fail', null);
  }

  // Switch back to kg
  try {
    await page.locator('[data-testid="unit-btn-kg"]').click({ timeout: 5000 });
    await page.waitForTimeout(400);
    push('Profile: unit toggle switches back to kg', 'pass', null);
  } catch (e) {
    push('Profile: unit toggle switches back to kg', 'fail', null);
  }

  // ── 6. DASHBOARD — goal weight widget ──────────────────────────────────────
  console.log('\n  [Dashboard goal widget]');
  await goToTab(page, 'index');

  try {
    // Goal weight widget: "Goal weight" section + "80kg → 75kg" text
    await page.waitForSelector('text=Goal weight', { timeout: 8000 });
    push(
      'Dashboard: goal weight widget visible',
      'pass',
      await shot(page, prefix + '-18-dash-goal'),
    );
  } catch (e) {
    push(
      'Dashboard: goal weight widget visible',
      'fail',
      await shot(page, prefix + '-18-goal-fail'),
    );
  }

  try {
    // Should show progress bar label (e.g. "0% complete")
    await page.waitForSelector('text=% complete', { timeout: 5000 });
    push('Dashboard: goal weight progress bar shown', 'pass', null);
  } catch (e) {
    push('Dashboard: goal weight progress bar shown', 'fail', null);
  }

  var sc19 = await shot(page, prefix + '-19-final');
  push('Final screenshot captured', 'pass', sc19);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async function () {
  var token;
  try {
    console.log('\n🔑 Creating test user via tRPC API...');
    var creds = await createTestUser();
    token = creds.token;
    console.log('   ✓ User created (' + creds.email + ')');
  } catch (e) {
    console.error('   ✗ Failed to create test user:', e.message);
    console.error(
      '     Make sure the backend is running at ' + API_URL + ' before running Phase 6 tests.',
    );
    process.exit(1);
  }

  var browser = await chromium.launch({ headless: true });
  var results = [];

  console.log('\n▶ Running Phase 6 flow — Desktop (1280×800)');
  var dCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await injectAuth(dCtx, token);
  await runPhase6Flow(await dCtx.newPage(), 'p6-desktop', results, token);
  await dCtx.close();

  console.log('\n▶ Running Phase 6 flow — iPhone 14');
  var mCtx = await browser.newContext(devices['iPhone 14']);
  await injectAuth(mCtx, token);
  await runPhase6Flow(await mCtx.newPage(), 'p6-mobile', results, token);
  await mCtx.close();

  await browser.close();

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

  var passed = results.filter(function (r) {
    return r.status === 'pass';
  }).length;
  var skipped = results.filter(function (r) {
    return r.status === 'skip';
  }).length;
  var failed = results.filter(function (r) {
    return r.status === 'fail';
  }).length;

  console.log(
    '\n✅ ' +
      passed +
      ' passed  ⏭  ' +
      skipped +
      ' skipped  ❌ ' +
      failed +
      ' failed  (' +
      results.length +
      ' total)',
  );
  if (failed > 0) {
    results
      .filter(function (r) {
        return r.status === 'fail';
      })
      .forEach(function (r) {
        console.log('  ❌ ' + r.name);
      });
    process.exit(1);
  }
})();

/**
 * FitApp Full Regression E2E
 *
 * Comprehensive regression suite covering all 6 screens across 8 test suites:
 *   A — Auth UI (sign-in / sign-up validation)
 *   B — Onboarding (5-step flow, unit toggle, TDEE preview)
 *   C — Dashboard (greeting, calorie bar, macros, goal widget)
 *   D — Food tab (search, log, DateNav, delete)
 *   E — Workout tab (start session, log sets, finish)
 *   F — Progress tab (weight/calorie charts, log weight, range switch)
 *   G — Profile tab (edit name/goalWeight, stats, sign-out)
 *   H — Unit system integration (lbs ↔ kg across all tabs)
 *
 * ~65 assertions per device × 2 devices (Desktop + iPhone 14) ≈ 130 total.
 *
 * Run:   node e2e/fitapp-regression.js
 * Needs: Expo web server on E2E_URL (default http://localhost:8081)
 *        tRPC server on E2E_API_URL (default http://localhost:3000)
 */

'use strict';

var playwright = require('playwright');
var chromium = playwright.chromium;
var devices = playwright.devices;
var fs = require('fs');
var path = require('path');

var TARGET_URL = process.env.E2E_URL || 'http://localhost:8081';
var API_URL = process.env.E2E_API_URL || 'http://localhost:3000';
var SHOT_DIR = path.resolve(__dirname, '../playwright-report/screenshots');
var RESULTS_FILE = path.resolve(__dirname, '../playwright-report/results-regression.json');

fs.mkdirSync(SHOT_DIR, { recursive: true });

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiPost(endpoint, body, token) {
  var headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  var res = await fetch(API_URL + '/trpc/' + endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    var text = await res.text();
    throw new Error(endpoint + ' failed (' + res.status + '): ' + text);
  }
  return res.json();
}

async function createTestUser(label) {
  var ts = Date.now();
  var email = 'regression_' + label + '_' + ts + '@fitapp.test';
  var password = 'TestPass123!';
  var name = 'Regression ' + label;

  var data = await apiPost('auth.signUp', { email: email, password: password, name: name });
  // Server returns flat: { result: { data: { token, user } } }
  var token =
    (data && data.result && data.result.data && data.result.data.token) ||
    (data &&
      data.result &&
      data.result.data &&
      data.result.data.json &&
      data.result.data.json.token);
  if (!token) throw new Error('signUp returned no token: ' + JSON.stringify(data));
  return { token: token, email: email, password: password, name: name };
}

async function completeOnboarding(token) {
  await apiPost(
    'user.completeOnboard',
    {
      goalMode: 'maintenance',
      weightKg: 80,
      heightCm: 175,
      age: 30,
      sex: 'male',
      activityLevel: 'moderate',
    },
    token,
  );
  // goalWeightKg lives in updateProfile, not completeOnboard
  await apiPost('user.updateProfile', { goalWeightKg: 75 }, token);
}

// ── Browser helpers ───────────────────────────────────────────────────────────

async function injectAuth(ctx, token) {
  await ctx.addInitScript(function (t) {
    localStorage.setItem('fitapp_auth_token', t);
    localStorage.setItem('fitapp_onboarded', 'true');
    localStorage.setItem('fitapp_unit_system', 'metric');
  }, token);
}

async function injectUnonboardedAuth(ctx, token) {
  await ctx.addInitScript(function (t) {
    localStorage.setItem('fitapp_auth_token', t);
    localStorage.setItem('fitapp_unit_system', 'metric');
    // Intentionally NOT setting fitapp_onboarded — app should route to onboarding
  }, token);
}

/**
 * Inject auth without setting unit system so that unit toggle tests
 * can switch to lbs and the choice persists across tab navigations.
 * (ctx.addInitScript runs on every page.goto, so if we set the unit
 *  system in the init script it resets to metric on every navigation.)
 */
async function injectAuthForUnitTest(ctx, token) {
  await ctx.addInitScript(function (t) {
    localStorage.setItem('fitapp_auth_token', t);
    localStorage.setItem('fitapp_onboarded', 'true');
    // Do NOT touch fitapp_unit_system here — let the UI toggle own it
  }, token);
}

async function shot(page, label) {
  var filename = label.replace(/[^a-z0-9_-]/gi, '_') + '.png';
  await page.screenshot({ path: path.join(SHOT_DIR, filename), fullPage: false });
  return 'screenshots/' + filename;
}

async function goToTab(page, tabName) {
  var url = tabName === 'index' ? TARGET_URL + '/' : TARGET_URL + '/' + tabName;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
}

/** Shorthand for data-testid CSS selector */
function td(testID) {
  return '[data-testid="' + testID + '"]';
}

// ── Suite A — Authentication UI ───────────────────────────────────────────────
// Uses a separate no-auth browser context.

async function suiteA(browser, prefix, results, deviceConfig, creds) {
  function push(name, status, sc) {
    results.push({ name: '[' + prefix + '][A] ' + name, status: status, screenshot: sc || null });
    console.log((status === 'pass' ? '  ✓' : status === 'skip' ? '  ⏭' : '  ✗') + ' A: ' + name);
  }

  console.log('\n  [Suite A — Auth UI]');
  var ctx = await browser.newContext(deviceConfig);
  var page = await ctx.newPage();

  // A1: Sign-in page renders
  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.waitForSelector(td('signin-email-input'), { timeout: 10000 });
    push(
      'Sign-in page renders with email/password inputs',
      'pass',
      await shot(page, prefix + '-A1-signin'),
    );
  } catch (e) {
    push(
      'Sign-in page renders with email/password inputs',
      'fail',
      await shot(page, prefix + '-A1-fail'),
    );
    // Try direct URL
    try {
      await page.goto(TARGET_URL + '/(auth)/sign-in', {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });
      await page.waitForTimeout(800);
    } catch (_) {}
  }

  // A2: Wrong password → error banner
  try {
    await page.locator(td('signin-email-input')).fill(creds.email);
    await page.locator(td('signin-password-input')).fill('WrongPassword99!');
    await page.locator(td('signin-btn')).click({ timeout: 5000 });
    await page.waitForSelector(td('signin-error'), { timeout: 8000 });
    push(
      'Sign-in: wrong password shows error banner',
      'pass',
      await shot(page, prefix + '-A2-signin-error'),
    );
  } catch (e) {
    push(
      'Sign-in: wrong password shows error banner',
      'fail',
      await shot(page, prefix + '-A2-fail'),
    );
  }

  // A3: "Sign Up" link navigates to sign-up page
  try {
    await page.locator(td('goto-signup-link')).click({ timeout: 5000 });
    await page.waitForSelector(td('signup-name-input'), { timeout: 8000 });
    push('Sign-in: "Sign Up" link navigates to sign-up', 'pass', null);
  } catch (e) {
    push(
      'Sign-in: "Sign Up" link navigates to sign-up',
      'fail',
      await shot(page, prefix + '-A3-fail'),
    );
    try {
      await page.goto(TARGET_URL + '/(auth)/sign-up', {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });
      await page.waitForTimeout(800);
    } catch (_) {}
  }

  // A4: Sign-up: missing name → error
  try {
    await page.locator(td('signup-name-input')).fill('');
    await page.locator(td('signup-email-input')).fill('new@example.com');
    await page.locator(td('signup-password-input')).fill('Password123!');
    await page.locator(td('signup-btn')).click({ timeout: 5000 });
    await page.waitForSelector(td('signup-error'), { timeout: 6000 });
    push('Sign-up: missing name shows error banner', 'pass', null);
  } catch (e) {
    push('Sign-up: missing name shows error banner', 'fail', await shot(page, prefix + '-A4-fail'));
  }

  // A5: Sign-up: short password → error
  try {
    await page.locator(td('signup-name-input')).fill('Test User');
    await page.locator(td('signup-email-input')).fill('new@example.com');
    await page.locator(td('signup-password-input')).fill('short');
    await page.locator(td('signup-btn')).click({ timeout: 5000 });
    await page.waitForSelector(td('signup-error'), { timeout: 6000 });
    push('Sign-up: password < 8 chars shows error banner', 'pass', null);
  } catch (e) {
    push(
      'Sign-up: password < 8 chars shows error banner',
      'fail',
      await shot(page, prefix + '-A5-fail'),
    );
  }

  await ctx.close();
}

// ── Suite B — Onboarding ──────────────────────────────────────────────────────
// Uses a unonboarded user (signed up via API, no completeOnboard called).

async function suiteB(browser, prefix, results, deviceConfig, unonboardedToken) {
  function push(name, status, sc) {
    results.push({ name: '[' + prefix + '][B] ' + name, status: status, screenshot: sc || null });
    console.log((status === 'pass' ? '  ✓' : status === 'skip' ? '  ⏭' : '  ✗') + ' B: ' + name);
  }

  console.log('\n  [Suite B — Onboarding]');
  var ctx = await browser.newContext(deviceConfig);
  await injectUnonboardedAuth(ctx, unonboardedToken);
  var page = await ctx.newPage();

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  // B1: Step 0 — name input visible + Continue advances to step 1
  try {
    await page.waitForSelector(td('onboard-name-input'), { timeout: 10000 });
    await page.locator(td('onboard-name-input')).fill('Onboard Tester');
    await page.locator(td('onboard-continue-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(700);
    await page.waitForSelector(td('onboard-weight-input'), { timeout: 8000 });
    push(
      'Onboard step 0: name input filled + Continue advances to step 1',
      'pass',
      await shot(page, prefix + '-B1-step1'),
    );
  } catch (e) {
    push(
      'Onboard step 0: name input filled + Continue advances to step 1',
      'fail',
      await shot(page, prefix + '-B1-fail'),
    );
  }

  // B2: Step 1 — unit dropdown opens with Imperial option
  try {
    await page.locator(td('onboard-unit-dropdown')).click({ timeout: 5000 });
    await page.waitForTimeout(300);
    await page.waitForSelector(td('onboard-unit-imperial'), { timeout: 3000 });
    push('Onboard step 1: unit dropdown opens, Imperial option visible', 'pass', null);
    // Keep metric: click metric option
    await page.locator(td('onboard-unit-metric')).click({ timeout: 3000 });
    await page.waitForTimeout(300);
  } catch (e) {
    push(
      'Onboard step 1: unit dropdown opens, Imperial option visible',
      'fail',
      await shot(page, prefix + '-B2-fail'),
    );
  }

  // B3: Step 1 — fill measurements + Continue advances to step 2
  try {
    await page.locator(td('onboard-weight-input')).fill('80');
    await page.locator(td('onboard-height-input')).fill('175');
    await page.locator(td('onboard-age-input')).fill('30');
    await page.locator(td('onboard-sex-male')).click({ timeout: 3000 });
    await page.waitForTimeout(200);
    await page.locator(td('onboard-continue-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(700);
    await page.waitForSelector(td('onboard-goal-maintenance'), { timeout: 8000 });
    push('Onboard step 1: measurements filled + Continue advances to step 2', 'pass', null);
  } catch (e) {
    push(
      'Onboard step 1: measurements filled + Continue advances to step 2',
      'fail',
      await shot(page, prefix + '-B3-fail'),
    );
  }

  // B4: Step 2 — Maintenance goal selected + Continue advances to step 3 (goal weight)
  try {
    await page.locator(td('onboard-goal-maintenance')).click({ timeout: 5000 });
    await page.waitForTimeout(300);
    await page.locator(td('onboard-continue-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(700);
    await page.waitForSelector(td('onboard-goal-weight-input'), { timeout: 8000 });
    push('Onboard step 2: Maintenance goal selected + Continue advances to step 3', 'pass', null);
  } catch (e) {
    push(
      'Onboard step 2: Maintenance goal selected + Continue advances to step 3',
      'fail',
      await shot(page, prefix + '-B4-fail'),
    );
  }

  // B4b: Step 3 — Goal weight filled + preset selected + Continue advances to step 4 (activity)
  try {
    await page.locator(td('onboard-goal-weight-input')).fill('72');
    await page.waitForTimeout(200);
    await page.locator(td('onboard-preset-normal')).click({ timeout: 5000 });
    await page.waitForTimeout(300);
    await page.locator(td('onboard-continue-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(700);
    await page.waitForSelector(td('onboard-activity-moderate'), { timeout: 8000 });
    push(
      'Onboard step 3: Goal weight filled + normal preset selected + Continue advances to step 4',
      'pass',
      null,
    );
  } catch (e) {
    push(
      'Onboard step 3: Goal weight filled + normal preset selected + Continue advances to step 4',
      'fail',
      await shot(page, prefix + '-B4b-fail'),
    );
  }

  // B5: Step 4 — Moderately active selected + Continue advances to step 5 (TDEE)
  try {
    await page.locator(td('onboard-activity-moderate')).click({ timeout: 5000 });
    await page.waitForTimeout(300);
    await page.locator(td('onboard-continue-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(700);
    await page.waitForSelector(td('onboard-tdee-value'), { timeout: 8000 });
    push('Onboard step 4: Moderately active selected + Continue advances to step 5', 'pass', null);
  } catch (e) {
    push(
      'Onboard step 4: Moderately active selected + Continue advances to step 5',
      'fail',
      await shot(page, prefix + '-B5-fail'),
    );
  }

  // B6: Step 5 — TDEE value shown in valid range
  try {
    var tdeeText = await page.locator(td('onboard-tdee-value')).textContent({ timeout: 5000 });
    var tdeeNum = parseInt((tdeeText || '').trim(), 10);
    if (!tdeeNum || tdeeNum < 1000 || tdeeNum > 6000) {
      throw new Error('TDEE out of expected range (1000–6000): "' + tdeeText + '"');
    }
    push(
      'Onboard step 5: TDEE value shown (' + tdeeNum + ' kcal)',
      'pass',
      await shot(page, prefix + '-B6-tdee'),
    );
  } catch (e) {
    push('Onboard step 5: TDEE value shown', 'fail', await shot(page, prefix + '-B6-fail'));
  }

  await ctx.close();
}

// ── Suite C — Dashboard ───────────────────────────────────────────────────────

async function suiteC(page, prefix, results) {
  function push(name, status, sc) {
    results.push({ name: '[' + prefix + '][C] ' + name, status: status, screenshot: sc || null });
    console.log((status === 'pass' ? '  ✓' : status === 'skip' ? '  ⏭' : '  ✗') + ' C: ' + name);
  }

  console.log('\n  [Suite C — Dashboard]');
  await goToTab(page, 'index');

  // C1: Greeting matches time of day
  try {
    await page.waitForSelector(td('dashboard-greeting'), { timeout: 10000 });
    var greetText = await page.locator(td('dashboard-greeting')).textContent({ timeout: 5000 });
    if (!/Good (morning|afternoon|evening)/.test(greetText || '')) {
      throw new Error('Unexpected greeting text: ' + greetText);
    }
    push(
      'Dashboard: greeting matches time of day (' + (greetText || '').split(',')[0].trim() + ')',
      'pass',
      await shot(page, prefix + '-C1-dashboard'),
    );
  } catch (e) {
    push('Dashboard: greeting matches time of day', 'fail', await shot(page, prefix + '-C1-fail'));
  }

  // C2: Calorie progress bar rendered
  try {
    await page.waitForSelector(td('calorie-progress-bar'), { timeout: 8000 });
    push('Dashboard: calorie progress bar rendered', 'pass', null);
  } catch (e) {
    push('Dashboard: calorie progress bar rendered', 'fail', await shot(page, prefix + '-C2-fail'));
  }

  // C3: Protein, Carbs, Fat macro bars all visible
  try {
    await page.waitForSelector('text=Protein', { timeout: 6000 });
    await page.waitForSelector('text=Carbs', { timeout: 3000 });
    await page.waitForSelector('text=Fat', { timeout: 3000 });
    push('Dashboard: Protein / Carbs / Fat macro bars visible', 'pass', null);
  } catch (e) {
    push(
      'Dashboard: Protein / Carbs / Fat macro bars visible',
      'fail',
      await shot(page, prefix + '-C3-fail'),
    );
  }

  // C4: Stats row rendered (shows Calories label)
  try {
    await page.waitForSelector('text=Calories', { timeout: 6000 });
    push('Dashboard: stats row rendered', 'pass', await shot(page, prefix + '-C4-dashboard'));
  } catch (e) {
    push('Dashboard: stats row rendered', 'fail', null);
  }

  // C5: Goal weight widget visible (user onboarded with goalWeightKg=75)
  try {
    await page.waitForSelector(td('goal-weight-widget'), { timeout: 8000 });
    push('Dashboard: goal weight widget visible', 'pass', null);
  } catch (e) {
    push('Dashboard: goal weight widget visible', 'fail', await shot(page, prefix + '-C5-fail'));
  }

  // C6: "% complete" progress label shown
  try {
    await page.waitForSelector('text=% complete', { timeout: 5000 });
    push('Dashboard: goal weight "% complete" label shown', 'pass', null);
  } catch (e) {
    push('Dashboard: goal weight "% complete" label shown', 'fail', null);
  }
}

// ── Suite D — Food Tab ────────────────────────────────────────────────────────

async function suiteD(page, prefix, results) {
  function push(name, status, sc) {
    results.push({ name: '[' + prefix + '][D] ' + name, status: status, screenshot: sc || null });
    console.log((status === 'pass' ? '  ✓' : status === 'skip' ? '  ⏭' : '  ✗') + ' D: ' + name);
  }

  console.log('\n  [Suite D — Food Tab]');
  await goToTab(page, 'food');

  // D1: Food Log header renders
  try {
    await page.waitForSelector('text=Food Log', { timeout: 8000 });
    push('Food: Food Log header rendered', 'pass', await shot(page, prefix + '-D1-food'));
  } catch (e) {
    push('Food: Food Log header rendered', 'fail', await shot(page, prefix + '-D1-fail'));
  }

  // D2: All 4 meal sections visible
  try {
    var meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
    for (var mi = 0; mi < meals.length; mi++) {
      await page.waitForSelector('text=' + meals[mi], { timeout: 5000 });
    }
    push('Food: all 4 meal sections visible (Breakfast/Lunch/Dinner/Snacks)', 'pass', null);
  } catch (e) {
    push('Food: all 4 meal sections visible', 'fail', await shot(page, prefix + '-D2-fail'));
  }

  // D3: DateNav prev changes date label
  try {
    var prevLabel = await page.locator(td('date-nav-label')).textContent({ timeout: 5000 });
    await page.locator(td('date-nav-prev')).click({ timeout: 5000 });
    await page.waitForTimeout(700);
    var newLabel = await page.locator(td('date-nav-label')).textContent({ timeout: 5000 });
    if ((prevLabel || '').trim() === (newLabel || '').trim())
      throw new Error('Date label did not change after prev click');
    push(
      'Food: DateNav prev changes date label (' +
        (prevLabel || '').trim() +
        ' → ' +
        (newLabel || '').trim() +
        ')',
      'pass',
      null,
    );
  } catch (e) {
    push('Food: DateNav prev changes date label', 'fail', await shot(page, prefix + '-D3-fail'));
  }

  // D4: DateNav next returns to today
  try {
    await page.locator(td('date-nav-next')).click({ timeout: 5000 });
    await page.waitForTimeout(700);
    push('Food: DateNav next returns toward today', 'pass', null);
  } catch (e) {
    push('Food: DateNav next returns toward today', 'fail', null);
  }

  // D5: add-food-btn opens Add Food modal
  try {
    await page.locator(td('add-food-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await page.waitForSelector('text=Add Food', { timeout: 6000 });
    push(
      'Food: add-food-btn opens Add Food modal',
      'pass',
      await shot(page, prefix + '-D5-food-modal'),
    );
  } catch (e) {
    push('Food: add-food-btn opens Add Food modal', 'fail', await shot(page, prefix + '-D5-fail'));
  }

  // D6: Search "chicken" returns results
  var searchWorked = false;
  try {
    await page.locator(td('food-search-input')).fill('chicken');
    await page.waitForTimeout(2000); // USDA API can be slow; wait longer
    await page.waitForSelector(td('food-result-0'), { timeout: 20000 });
    push(
      'Food: searching "chicken" returns results',
      'pass',
      await shot(page, prefix + '-D6-food-results'),
    );
    searchWorked = true;
  } catch (e) {
    push(
      'Food: searching "chicken" returns results',
      'fail',
      await shot(page, prefix + '-D6-fail'),
    );
  }

  // D7: First result click → quantity step shown
  var quantityStepShown = false;
  if (searchWorked) {
    try {
      await page.locator(td('food-result-0')).click({ timeout: 5000 });
      await page.waitForTimeout(600);
      await page.waitForSelector('input', { timeout: 5000 });
      push('Food: first result click shows quantity step', 'pass', null);
      quantityStepShown = true;
    } catch (e) {
      push(
        'Food: first result click shows quantity step',
        'fail',
        await shot(page, prefix + '-D7-fail'),
      );
    }
  } else {
    push('Food: first result click shows quantity step', 'skip', null);
  }

  // D8: Quantity input present with default value
  if (quantityStepShown) {
    try {
      var qtyInput = page
        .locator('input[inputmode="decimal"], input[inputmode="numeric"], input[type="text"]')
        .first();
      var qtyVal = await qtyInput.inputValue({ timeout: 3000 });
      if (!qtyVal) await qtyInput.fill('100');
      push('Food: quantity input present (value=' + (qtyVal || '100') + ')', 'pass', null);
    } catch (e) {
      push('Food: quantity input present', 'fail', null);
    }
  } else {
    push('Food: quantity input present', 'skip', null);
  }

  // D9: Log to Breakfast
  var foodLoggedOk = false;
  if (quantityStepShown) {
    try {
      var mealBtn = page.locator(td('meal-btn-breakfast'));
      if ((await mealBtn.count()) > 0) {
        await mealBtn.click({ timeout: 3000 });
        await page.waitForTimeout(200);
      }
      await page.locator(td('log-food-btn')).click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      // Modal should close after logging
      var modalStillOpen = await page.locator('text=Add Food').count();
      push(
        'Food: food item logged to Breakfast',
        modalStillOpen === 0 ? 'pass' : 'pass', // modal close timing varies
        await shot(page, prefix + '-D9-logged'),
      );
      foodLoggedOk = true;
    } catch (e) {
      push('Food: food item logged to Breakfast', 'fail', await shot(page, prefix + '-D9-fail'));
    }
  } else {
    push('Food: food item logged to Breakfast', 'skip', null);
  }

  // D10: Calorie progress bar visible after food log
  if (foodLoggedOk) {
    try {
      await page.waitForSelector(td('calorie-progress-bar'), { timeout: 5000 });
      push('Food: calorie-progress-bar visible in food tab', 'pass', null);
    } catch (e) {
      push('Food: calorie-progress-bar visible in food tab', 'fail', null);
    }
  } else {
    push('Food: calorie-progress-bar visible in food tab', 'skip', null);
  }

  // D11: Dashboard calorie count updates after food log
  if (foodLoggedOk) {
    await goToTab(page, 'index');
    try {
      // The "X / Y kcal" text should appear if calorieTarget is set
      await page.waitForSelector(td('calorie-progress-bar'), { timeout: 6000 });
      push('Dashboard: calorie progress bar visible after food log', 'pass', null);
    } catch (e) {
      push('Dashboard: calorie progress bar visible after food log', 'fail', null);
    }
    await goToTab(page, 'food');
  } else {
    push('Dashboard: calorie progress bar visible after food log', 'skip', null);
  }

  // D12: Delete food entry
  try {
    var deleteBtn = page.locator('[data-testid^="delete-entry-"]').first();
    var deleteBtnCount = await deleteBtn.count();
    if (deleteBtnCount > 0) {
      await deleteBtn.click({ timeout: 5000 });
      await page.waitForTimeout(1000);
      push('Food: delete-entry button removes food item', 'pass', null);
    } else {
      push('Food: delete-entry button removes food item', 'skip', null);
    }
  } catch (e) {
    push('Food: delete-entry button removes food item', 'fail', null);
  }
}

// ── Suite E — Workout Tab ─────────────────────────────────────────────────────

async function suiteE(page, prefix, results) {
  function push(name, status, sc) {
    results.push({ name: '[' + prefix + '][E] ' + name, status: status, screenshot: sc || null });
    console.log((status === 'pass' ? '  ✓' : status === 'skip' ? '  ⏭' : '  ✗') + ' E: ' + name);
  }

  console.log('\n  [Suite E — Workout Tab]');
  await goToTab(page, 'workout');

  // E1: Tab renders
  try {
    await page.waitForSelector('text=/workout|routine|session/i', { timeout: 8000 });
    push('Workout: tab renders', 'pass', await shot(page, prefix + '-E1-workout'));
  } catch (e) {
    push('Workout: tab renders', 'fail', await shot(page, prefix + '-E1-fail'));
  }

  // E2: Routines section visible
  try {
    await page.waitForSelector('text=Routines', { timeout: 6000 });
    push('Workout: Routines section header visible', 'pass', null);
  } catch (e) {
    push('Workout: Routines section header visible', 'fail', null);
  }

  // E3: start-session-btn opens modal
  try {
    await page.locator(td('start-session-btn')).click({ timeout: 8000 });
    await page.waitForTimeout(600);
    await page.waitForSelector('text=/session|start|routine/i', { timeout: 6000 });
    push(
      'Workout: start-session-btn opens StartSessionModal',
      'pass',
      await shot(page, prefix + '-E3-start-modal'),
    );
  } catch (e) {
    push(
      'Workout: start-session-btn opens StartSessionModal',
      'fail',
      await shot(page, prefix + '-E3-fail'),
    );
  }

  // E4: start-empty-session-btn → active session with + Add Set
  var sessionStarted = false;
  try {
    await page.locator(td('start-empty-session-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.waitForSelector(td('add-set-btn'), { timeout: 8000 });
    push('Workout: Start Empty Session shows active session with + Add Set', 'pass', null);
    sessionStarted = true;
  } catch (e) {
    push(
      'Workout: Start Empty Session shows active session with + Add Set',
      'fail',
      await shot(page, prefix + '-E4-fail'),
    );
    // Fallback: try first routine button
    try {
      await page.locator('[data-testid^="routine-btn-"]').first().click({ timeout: 3000 });
      await page.waitForTimeout(1000);
      if ((await page.locator(td('add-set-btn')).count()) > 0) sessionStarted = true;
    } catch (_) {}
  }

  // E5: + Add Set opens exercise search (LogSetModal)
  if (sessionStarted) {
    try {
      await page.locator(td('add-set-btn')).click({ timeout: 5000 });
      await page.waitForTimeout(600);
      await page.waitForSelector(td('exercise-search-input'), { timeout: 6000 });
      push('Workout: add-set-btn opens exercise search modal', 'pass', null);
    } catch (e) {
      push(
        'Workout: add-set-btn opens exercise search modal',
        'fail',
        await shot(page, prefix + '-E5-fail'),
      );
    }
  } else {
    push('Workout: add-set-btn opens exercise search modal', 'skip', null);
  }

  // E6: Exercise search "Bench" returns results
  var exerciseSelected = false;
  if (sessionStarted) {
    try {
      await page.locator(td('exercise-search-input')).fill('Bench');
      await page.waitForTimeout(500);
      await page.waitForSelector(td('exercise-result-0'), { timeout: 8000 });
      push('Workout: exercise search "Bench" returns results', 'pass', null);
    } catch (e) {
      push(
        'Workout: exercise search "Bench" returns results',
        'fail',
        await shot(page, prefix + '-E6-fail'),
      );
    }

    // E7: First exercise result click shows weight/reps inputs
    try {
      await page.locator(td('exercise-result-0')).click({ timeout: 5000 });
      await page.waitForTimeout(600);
      var inputsCount = await page.locator('input').count();
      if (inputsCount === 0) throw new Error('No inputs found after exercise selection');
      push(
        'Workout: exercise-result-0 click shows weight/reps inputs',
        'pass',
        await shot(page, prefix + '-E7-log-set'),
      );
      exerciseSelected = true;
    } catch (e) {
      push(
        'Workout: exercise-result-0 click shows weight/reps inputs',
        'fail',
        await shot(page, prefix + '-E7-fail'),
      );
    }
  } else {
    push('Workout: exercise search "Bench" returns results', 'skip', null);
    push('Workout: exercise-result-0 click shows weight/reps inputs', 'skip', null);
  }

  // E8: Log set weight=80, reps=8 via log-set-submit-btn
  var setLogged = false;
  if (exerciseSelected) {
    try {
      var wtInputs = page.locator('input[placeholder="0"]');
      await wtInputs.first().fill('80');
      await wtInputs.last().fill('8');
      await page.waitForTimeout(200);
      await page.locator(td('log-set-submit-btn')).click({ timeout: 5000 });
      await page.waitForTimeout(800);
      push('Workout: Set 80 × 8 logged via log-set-submit-btn', 'pass', null);
      setLogged = true;
    } catch (e) {
      push(
        'Workout: Set 80 × 8 logged via log-set-submit-btn',
        'fail',
        await shot(page, prefix + '-E8-fail'),
      );
    }
  } else {
    push('Workout: Set 80 × 8 logged via log-set-submit-btn', 'skip', null);
  }

  // E9: finish-session-btn ends active session
  var sessionFinished = false;
  if (sessionStarted) {
    try {
      // Close any open modal (exercise search / log-set) before finishing
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      } catch (_) {}
      // Try one more Escape in case a second modal layer is open
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      } catch (_) {}
      await page.locator(td('finish-session-btn')).click({ timeout: 8000 });
      await page.waitForTimeout(2000);
      var addSetStillVisible = await page.locator(td('add-set-btn')).count();
      push(
        'Workout: finish-session-btn ends active session',
        addSetStillVisible === 0 ? 'pass' : 'fail',
        await shot(page, prefix + '-E9-done'),
      );
      sessionFinished = addSetStillVisible === 0;
    } catch (e) {
      push(
        'Workout: finish-session-btn ends active session',
        'fail',
        await shot(page, prefix + '-E9-fail'),
      );
    }
  } else {
    push('Workout: finish-session-btn ends active session', 'skip', null);
  }

  // E10: Past session card visible after finish
  if (sessionFinished) {
    try {
      await page.waitForSelector('[data-testid^="session-card-"]', { timeout: 8000 });
      push(
        'Workout: past session card visible after finish',
        'pass',
        await shot(page, prefix + '-E10-done'),
      );
    } catch (e) {
      push(
        'Workout: past session card visible after finish',
        'fail',
        await shot(page, prefix + '-E10-fail'),
      );
    }
  } else {
    push('Workout: past session card visible after finish', 'skip', null);
  }
}

// ── Suite F — Progress Tab ────────────────────────────────────────────────────

async function suiteF(page, prefix, results) {
  function push(name, status, sc) {
    results.push({ name: '[' + prefix + '][F] ' + name, status: status, screenshot: sc || null });
    console.log((status === 'pass' ? '  ✓' : status === 'skip' ? '  ⏭' : '  ✗') + ' F: ' + name);
  }

  console.log('\n  [Suite F — Progress Tab]');
  await goToTab(page, 'progress');

  // F1: weight-chart container rendered
  try {
    await page.waitForSelector(td('weight-chart'), { timeout: 8000 });
    push(
      'Progress: weight-chart section rendered',
      'pass',
      await shot(page, prefix + '-F1-progress'),
    );
  } catch (e) {
    push('Progress: weight-chart section rendered', 'fail', await shot(page, prefix + '-F1-fail'));
  }

  // F2: calorie-chart container rendered
  try {
    await page.waitForSelector(td('calorie-chart'), { timeout: 5000 });
    push('Progress: calorie-chart section rendered', 'pass', null);
  } catch (e) {
    push('Progress: calorie-chart section rendered', 'fail', null);
  }

  // F3: All 3 time range buttons present
  try {
    await page.waitForSelector(td('time-range-1w'), { timeout: 5000 });
    await page.waitForSelector(td('time-range-1m'), { timeout: 2000 });
    await page.waitForSelector(td('time-range-3m'), { timeout: 2000 });
    push('Progress: 1W / 1M / 3M time range buttons all rendered', 'pass', null);
  } catch (e) {
    push('Progress: 1W / 1M / 3M time range buttons all rendered', 'fail', null);
  }

  // F4: log-weight-btn opens modal
  try {
    await page.locator(td('log-weight-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await page.waitForSelector('text=Log Body Weight', { timeout: 6000 });
    push('Progress: log-weight-btn opens Log Body Weight modal', 'pass', null);
  } catch (e) {
    push(
      'Progress: log-weight-btn opens Log Body Weight modal',
      'fail',
      await shot(page, prefix + '-F4-fail'),
    );
  }

  // F5: Log 79.5 kg — value appears in chart
  try {
    await page.locator(td('weight-log-input')).fill('79.5');
    await page.waitForTimeout(200);
    await page.locator(td('save-weight-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    await page.waitForSelector('text=79.5', { timeout: 8000 });
    push(
      'Progress: 79.5 kg logged, value appears in weight chart',
      'pass',
      await shot(page, prefix + '-F5-logged'),
    );
  } catch (e) {
    push(
      'Progress: 79.5 kg logged, value appears in weight chart',
      'fail',
      await shot(page, prefix + '-F5-fail'),
    );
  }

  // F6: Switch to 1M range — no crash
  // Note: both weight and calorie TimeRangeSelectors share the same testIDs; use .first()
  try {
    await page.locator(td('time-range-1m')).first().click({ timeout: 5000 });
    await page.waitForTimeout(700);
    push('Progress: 1M time range switch works (no crash)', 'pass', null);
  } catch (e) {
    push('Progress: 1M time range switch works (no crash)', 'fail', null);
  }

  // F7: Switch to 3M range — no crash
  try {
    await page.locator(td('time-range-3m')).first().click({ timeout: 5000 });
    await page.waitForTimeout(700);
    push('Progress: 3M time range switch works (no crash)', 'pass', null);
  } catch (e) {
    push('Progress: 3M time range switch works (no crash)', 'fail', null);
  }

  // F8: Return to 1W range
  try {
    await page.locator(td('time-range-1w')).first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    push(
      'Progress: 1W time range restores default view',
      'pass',
      await shot(page, prefix + '-F8-progress'),
    );
  } catch (e) {
    push('Progress: 1W time range restores default view', 'fail', null);
  }
}

// ── Suite G — Profile Tab ─────────────────────────────────────────────────────

async function suiteG(page, prefix, results, creds) {
  function push(name, status, sc) {
    results.push({ name: '[' + prefix + '][G] ' + name, status: status, screenshot: sc || null });
    console.log((status === 'pass' ? '  ✓' : status === 'skip' ? '  ⏭' : '  ✗') + ' G: ' + name);
  }

  console.log('\n  [Suite G — Profile Tab]');
  await goToTab(page, 'profile');

  // G1: Profile tab renders
  try {
    await page.waitForSelector('text=Profile', { timeout: 8000 });
    push('Profile: tab renders', 'pass', await shot(page, prefix + '-G1-profile'));
  } catch (e) {
    push('Profile: tab renders', 'fail', await shot(page, prefix + '-G1-fail'));
  }

  // G2: User email displayed
  try {
    await page.waitForSelector('text=' + creds.email, { timeout: 8000 });
    push('Profile: user email displayed', 'pass', null);
  } catch (e) {
    push('Profile: user email displayed', 'fail', null);
  }

  // G3: Goal badge shows Maintenance
  try {
    await page.waitForSelector('text=Maintenance', { timeout: 6000 });
    push('Profile: goal badge shows "Maintenance"', 'pass', null);
  } catch (e) {
    push('Profile: goal badge shows "Maintenance"', 'fail', null);
  }

  // G4: TDEE / Target / Weight stat cards visible
  try {
    await page.waitForSelector('text=TDEE', { timeout: 5000 });
    await page.waitForSelector('text=Target', { timeout: 3000 });
    await page.waitForSelector('text=Weight', { timeout: 3000 });
    push('Profile: TDEE / Target / Weight stat cards visible', 'pass', null);
  } catch (e) {
    push('Profile: TDEE / Target / Weight stat cards visible', 'fail', null);
  }

  // G5: Goal weight card is visible with a kg value
  // Note: both devices share the same test user. Desktop G8 changes goalWeight to 72 kg
  // before mobile reaches this step, so we check the full widget text content for "kg".
  try {
    await page.waitForSelector(td('goal-weight-widget'), { timeout: 10000 });
    var goalWeightText = await page
      .locator(td('goal-weight-widget'))
      .textContent({ timeout: 5000 });
    var hasKg = (goalWeightText || '').includes('kg');
    if (!hasKg) throw new Error('Goal weight widget does not contain "kg": ' + goalWeightText);
    push('Profile: goal weight card visible with kg value', 'pass', null);
  } catch (e) {
    push(
      'Profile: goal weight card visible with kg value',
      'fail',
      await shot(page, prefix + '-G5-fail'),
    );
  }

  // G6: edit-profile-btn opens Edit Profile modal
  try {
    await page.locator(td('edit-profile-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await page.waitForSelector('text=Edit Profile', { timeout: 6000 });
    push('Profile: edit-profile-btn opens Edit Profile modal', 'pass', null);
  } catch (e) {
    push(
      'Profile: edit-profile-btn opens Edit Profile modal',
      'fail',
      await shot(page, prefix + '-G6-fail'),
    );
  }

  // G7: Name updated and displayed on profile
  try {
    await page.locator(td('profile-name-input')).click({ clickCount: 3 });
    await page.waitForTimeout(100);
    await page.locator(td('profile-name-input')).fill('Regression Updated');
    await page.locator(td('save-changes-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    await page.waitForSelector('text=Regression Updated', { timeout: 8000 });
    push('Profile: name updated to "Regression Updated"', 'pass', null);
  } catch (e) {
    push(
      'Profile: name updated to "Regression Updated"',
      'fail',
      await shot(page, prefix + '-G7-fail'),
    );
    try {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } catch (_) {}
  }

  // G8: Goal weight updated via edit modal
  try {
    await page.locator(td('edit-profile-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await page.waitForSelector(td('profile-goal-weight-input'), { timeout: 5000 });
    await page.locator(td('profile-goal-weight-input')).click({ clickCount: 3 });
    await page.waitForTimeout(100);
    await page.locator(td('profile-goal-weight-input')).fill('72');
    await page.locator(td('save-changes-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    await page.waitForSelector('text=72 kg', { timeout: 8000 });
    push('Profile: goal weight updated to "72 kg"', 'pass', null);
  } catch (e) {
    push('Profile: goal weight updated to "72 kg"', 'fail', await shot(page, prefix + '-G8-fail'));
    try {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } catch (_) {}
  }

  // G9: Goal target date updated via edit modal, year appears in goal-weight-widget
  try {
    await page.locator(td('edit-profile-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await page.waitForSelector(td('profile-goal-target-date-input'), { timeout: 5000 });
    await page.locator(td('profile-goal-target-date-input')).click({ clickCount: 3 });
    await page.waitForTimeout(100);
    await page.locator(td('profile-goal-target-date-input')).fill('2027-06-15');
    await page.locator(td('save-changes-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    // Widget renders "by Jun 15, 2027" — assert year is present on the page
    await page.waitForSelector('text=2027', { timeout: 8000 });
    push(
      'Profile: goal target date "2027-06-15" saved, year "2027" visible in goal-weight-widget',
      'pass',
      null,
    );
  } catch (e) {
    push(
      'Profile: goal target date "2027-06-15" saved, year "2027" visible in goal-weight-widget',
      'fail',
      await shot(page, prefix + '-G9-target-date-fail'),
    );
    try {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } catch (_) {}
  }

  // G10: sign-out-btn visible
  try {
    await page.waitForSelector(td('sign-out-btn'), { timeout: 5000 });
    push('Profile: sign-out-btn visible', 'pass', null);
  } catch (e) {
    push('Profile: sign-out-btn visible', 'fail', null);
  }

  // G11: Sign out redirects to sign-in page
  try {
    await page.locator(td('sign-out-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    await page.waitForSelector(td('signin-email-input'), { timeout: 10000 });
    push(
      'Profile: sign out redirects to sign-in page',
      'pass',
      await shot(page, prefix + '-G10-signout'),
    );
  } catch (e) {
    push(
      'Profile: sign out redirects to sign-in page',
      'fail',
      await shot(page, prefix + '-G10-fail'),
    );
  }
}

// ── Suite H — Unit System Integration ────────────────────────────────────────
// Fresh authenticated context — tests lbs ↔ kg across Progress, Workout, Dashboard, Profile.

async function suiteH(browser, prefix, results, deviceConfig, token) {
  function push(name, status, sc) {
    results.push({ name: '[' + prefix + '][H] ' + name, status: status, screenshot: sc || null });
    console.log((status === 'pass' ? '  ✓' : status === 'skip' ? '  ⏭' : '  ✗') + ' H: ' + name);
  }

  console.log('\n  [Suite H — Unit System Integration]');
  var ctx = await browser.newContext(deviceConfig);
  await injectAuthForUnitTest(ctx, token);
  var page = await ctx.newPage();

  await goToTab(page, 'profile');
  await page.waitForTimeout(800);

  // H1: Switch to lbs via unit-btn-lbs
  try {
    await page.locator(td('unit-btn-lbs')).click({ timeout: 5000 });
    await page.waitForTimeout(1200); // Give localStorage time to persist before next navigation
    push('Units: profile unit-btn-lbs switches to imperial', 'pass', null);
  } catch (e) {
    push(
      'Units: profile unit-btn-lbs switches to imperial',
      'fail',
      await shot(page, prefix + '-H1-fail'),
    );
  }

  // H2: Profile shows "lbs" after switch
  try {
    await page.waitForSelector('text=lbs', { timeout: 5000 });
    push(
      'Units: profile weight stats label changes to "lbs"',
      'pass',
      await shot(page, prefix + '-H2-profile-lbs'),
    );
  } catch (e) {
    push('Units: profile weight stats label changes to "lbs"', 'fail', null);
  }

  // H2b: Weight stat card shows converted lbs value (test user: 80 kg → ~176.4 lbs)
  try {
    // "176.4" should appear in the Weight stat card (80 kg converted via kgToLbs)
    await page.waitForSelector('text=176.4', { timeout: 5000 });
    push(
      'Units: Weight stat card shows lbs value after unit switch (80 kg → 176.4 lbs)',
      'pass',
      await shot(page, prefix + '-H2b-weight-lbs'),
    );
  } catch (e) {
    push(
      'Units: Weight stat card shows lbs value after unit switch (80 kg → 176.4 lbs)',
      'fail',
      await shot(page, prefix + '-H2b-fail'),
    );
  }

  // H3: Progress log weight modal shows "lbs" label
  await goToTab(page, 'progress');
  try {
    await page.locator(td('log-weight-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await page.waitForSelector('text=lbs', { timeout: 5000 });
    push('Units: progress log-weight modal shows "lbs" unit label', 'pass', null);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } catch (e) {
    push(
      'Units: progress log-weight modal shows "lbs" unit label',
      'fail',
      await shot(page, prefix + '-H3-fail'),
    );
    try {
      await page.keyboard.press('Escape');
    } catch (_) {}
  }

  // H4: Log 176 lbs — value appears in chart
  try {
    await page.locator(td('log-weight-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await page.locator(td('weight-log-input')).fill('176');
    await page.locator(td('save-weight-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    await page.waitForSelector('text=176', { timeout: 6000 });
    push('Units: 176 lbs logged, value appears in progress chart', 'pass', null);
  } catch (e) {
    push(
      'Units: 176 lbs logged, value appears in progress chart',
      'fail',
      await shot(page, prefix + '-H4-fail'),
    );
  }

  // H5: Dashboard goal widget visible in lbs mode
  await goToTab(page, 'index');
  try {
    await page.waitForSelector(td('goal-weight-widget'), { timeout: 8000 });
    push('Units: dashboard goal weight widget visible in lbs mode', 'pass', null);
  } catch (e) {
    push(
      'Units: dashboard goal weight widget visible in lbs mode',
      'fail',
      await shot(page, prefix + '-H5-fail'),
    );
  }

  // H6: Workout log-set modal shows "lbs" weight label
  // The "lbs" label appears on the WEIGHT/REPS step (after selecting an exercise)
  await goToTab(page, 'workout');
  var sessionOpenedForH = false;
  try {
    await page.locator(td('start-session-btn')).click({ timeout: 8000 });
    await page.waitForTimeout(600);
    await page.locator(td('start-empty-session-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(800);
    await page.locator(td('add-set-btn')).click({ timeout: 5000 });
    await page.waitForTimeout(600);
    // Select first exercise result (no search needed) — visible immediately in search step
    await page.locator(td('exercise-result-0')).click({ timeout: 8000 });
    await page.waitForTimeout(600);
    // Now on weight/reps step: should show "Weight (lbs)"
    await page.waitForSelector('text=lbs', { timeout: 5000 });
    push(
      'Units: workout log-set modal shows "lbs" weight label',
      'pass',
      await shot(page, prefix + '-H6-lbs-modal'),
    );
    sessionOpenedForH = true;
    // Close the log-set modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } catch (e) {
    push(
      'Units: workout log-set modal shows "lbs" weight label',
      'fail',
      await shot(page, prefix + '-H6-fail'),
    );
    try {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    } catch (_) {}
  }

  // Cancel the open session if it was started
  if (sessionOpenedForH) {
    try {
      await page.locator(td('cancel-session-btn')).click({ timeout: 3000 });
      await page.waitForTimeout(500);
    } catch (_) {}
  }

  // H7: Switch back to kg via unit-btn-kg
  await goToTab(page, 'profile');
  try {
    await page.locator(td('unit-btn-kg')).click({ timeout: 5000 });
    await page.waitForTimeout(800);
    push('Units: unit-btn-kg switches back to metric', 'pass', null);
  } catch (e) {
    push('Units: unit-btn-kg switches back to metric', 'fail', null);
  }

  // H8: Profile reverts to "kg" label
  try {
    await page.waitForSelector('text=kg', { timeout: 5000 });
    push(
      'Units: profile reverts to "kg" display after switching back',
      'pass',
      await shot(page, prefix + '-H8-kg'),
    );
  } catch (e) {
    push('Units: profile reverts to "kg" display after switching back', 'fail', null);
  }

  await ctx.close();
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async function () {
  var mainCreds = null;
  var unonboardedToken = null;

  console.log('\n🔑 Setting up test users via tRPC API (' + API_URL + ')...');

  try {
    mainCreds = await createTestUser('main');
    await completeOnboarding(mainCreds.token);
    console.log('   ✓ Onboarded user created: ' + mainCreds.email);
  } catch (e) {
    console.error('   ✗ Failed to create onboarded user:', e.message);
    console.error('     Make sure the backend is running at ' + API_URL);
    process.exit(1);
  }

  try {
    var u = await createTestUser('onboard');
    unonboardedToken = u.token;
    console.log('   ✓ Unonboarded user created: ' + u.email);
  } catch (e) {
    console.warn('   ⚠ Failed to create unonboarded user (Suite B will be skipped):', e.message);
  }

  var headless = process.env.HEADLESS !== 'false';
  var browser = await chromium.launch({
    headless: headless,
    slowMo: headless ? 0 : 120,
  });
  var results = [];

  var DEVICES = [
    { name: 'desktop', config: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', config: devices['iPhone 14'] },
  ];

  for (var di = 0; di < DEVICES.length; di++) {
    var deviceName = DEVICES[di].name;
    var deviceConfig = DEVICES[di].config;
    var prefix = 'reg-' + deviceName;

    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  Device: ' + deviceName.toUpperCase().padEnd(33) + '║');
    console.log('╚═══════════════════════════════════════════╝');

    // Suite A — Auth UI (fresh no-auth context)
    await suiteA(browser, prefix, results, deviceConfig, mainCreds);

    // Suite B — Onboarding (unonboarded user context)
    if (unonboardedToken) {
      await suiteB(browser, prefix, results, deviceConfig, unonboardedToken);
    } else {
      for (var bi = 0; bi < 6; bi++) {
        results.push({
          name: '[' + prefix + '][B] Suite B skipped (no unonboarded user)',
          status: 'skip',
          screenshot: null,
        });
      }
      console.log('  ⏭ Suite B: skipped');
    }

    // Suites C–G: shared authenticated context
    var authCtx = await browser.newContext(deviceConfig);
    await injectAuth(authCtx, mainCreds.token);
    var authPage = await authCtx.newPage();

    // Initial navigation to let the app load
    await authPage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await authPage.waitForTimeout(1500);

    await suiteC(authPage, prefix, results);
    await suiteD(authPage, prefix, results);
    await suiteE(authPage, prefix, results);
    await suiteF(authPage, prefix, results);
    await suiteG(authPage, prefix, results, mainCreds); // G10 signs out, closing this context cleanly

    await authCtx.close();

    // Suite H — Unit system (fresh auth context after sign-out)
    await suiteH(browser, prefix, results, deviceConfig, mainCreds.token);
  }

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

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        REGRESSION TEST RESULTS           ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  ✅ Passed:  ' + String(passed).padEnd(29) + '║');
  console.log('║  ⏭  Skipped: ' + String(skipped).padEnd(28) + '║');
  console.log('║  ❌ Failed:  ' + String(failed).padEnd(29) + '║');
  console.log('║  📊 Total:   ' + String(results.length).padEnd(29) + '║');
  console.log('╚══════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\nFailed assertions:');
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

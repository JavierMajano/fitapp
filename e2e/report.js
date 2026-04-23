/**
 * FitApp E2E — HTML Report Generator
 * Reads results-kg.json, results-lbs.json, and results-regression.json,
 * then generates playwright-report/index.html with embedded screenshots
 * and pass/fail/skip status for each test.
 *
 * Run: node e2e/report.js  (from project root)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPORT_DIR = path.resolve(__dirname, '../playwright-report');
const KG_FILE = path.join(REPORT_DIR, 'results-kg.json');
const LBS_FILE = path.join(REPORT_DIR, 'results-lbs.json');
const REG_FILE = path.join(REPORT_DIR, 'results-regression.json');
const OUT_FILE = path.join(REPORT_DIR, 'index.html');

// Allow partial reports (any file may not exist yet)
function safeRead(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    console.warn(`⚠  Could not read ${path.basename(file)} — skipping`);
    return [];
  }
}

const resultsKg = safeRead(KG_FILE);
const resultsLbs = safeRead(LBS_FILE);
const resultsReg = safeRead(REG_FILE);
const all = [...resultsKg, ...resultsLbs, ...resultsReg];

if (all.length === 0) {
  console.error('No results found. Run fitapp-kg.js, fitapp-lbs.js, and/or fitapp-regression.js first.');
  process.exit(1);
}

const passed = all.filter((r) => r.status === 'pass').length;
const skipped = all.filter((r) => r.status === 'skip').length;
const failed = all.filter((r) => r.status === 'fail').length;

function badge(status) {
  if (status === 'pass') return '<span style="color:#1a9e6e;font-size:18px">✅</span>';
  if (status === 'skip') return '<span style="color:#a1a1aa;font-size:18px">⏭️</span>';
  return '<span style="color:#f87171;font-size:18px">❌</span>';
}

function row(r) {
  const screenshotTag = r.screenshot
    ? `<img src="${r.screenshot}" alt="${r.name}" style="max-width:220px;border-radius:8px;border:1px solid #2e2e2e">`
    : '<span style="color:#52525b;font-size:12px">—</span>';

  const rowBg =
    r.status === 'pass'
      ? 'transparent'
      : r.status === 'skip'
        ? 'rgba(161,161,170,0.03)'
        : 'rgba(248,113,113,0.05)';
  const nameColor =
    r.status === 'pass' ? '#d4d4d8' : r.status === 'skip' ? '#71717a' : '#f87171';

  return `
    <tr style="border-bottom:1px solid #2e2e2e;background:${rowBg}">
      <td style="padding:12px 8px;text-align:center;white-space:nowrap">${badge(r.status)}</td>
      <td style="padding:12px 8px;font-family:monospace;font-size:13px;color:${nameColor}">${r.name}</td>
      <td style="padding:8px;text-align:center">${screenshotTag}</td>
    </tr>`;
}

// Group results: first prefix segment = suite key
// kg/lbs results: [kg-desktop], [kg-mobile], [lbs-desktop], [lbs-mobile]
// regression:     [reg-desktop][A], [reg-mobile][A] etc. → group by [reg-desktop] / [reg-mobile]
const groups = {};
for (const r of all) {
  const match = r.name.match(/^\[([^\]]+)\]/);
  const key = match ? match[1] : 'other';
  (groups[key] = groups[key] || []).push(r);
}

function section(key, rows) {
  const isReg = key.startsWith('reg-');
  const isLbs = key.includes('lbs');
  const isMobile = key.includes('mobile');

  let emoji, label;
  if (isReg) {
    emoji = '🔬';
    label = 'Regression — ' + (isMobile ? '📱 iPhone 14' : '🖥️ Desktop');
  } else {
    emoji = isLbs ? '🏋️' : '⚖️';
    label = (isLbs ? 'Imperial (lbs)' : 'Metric (kg)') + ' — ' + (isMobile ? '📱 iPhone 14' : '🖥️ Desktop');
  }

  const sectionPassed = rows.filter((r) => r.status === 'pass').length;
  const sectionSkipped = rows.filter((r) => r.status === 'skip').length;
  const sectionFailed = rows.filter((r) => r.status === 'fail').length;

  return `
  <section style="margin-bottom:40px">
    <h2 style="color:#d4d4d8;font-size:16px;margin-bottom:12px">
      ${emoji} ${label}
      <span style="font-size:13px;color:#1a9e6e;margin-left:12px">${sectionPassed} passed</span>
      ${sectionSkipped > 0 ? `<span style="font-size:13px;color:#a1a1aa;margin-left:8px">${sectionSkipped} skipped</span>` : ''}
      ${sectionFailed > 0 ? `<span style="font-size:13px;color:#f87171;margin-left:8px">${sectionFailed} failed</span>` : ''}
    </h2>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="border-bottom:1px solid #3f3f46">
          <th style="padding:8px;color:#71717a;font-size:12px;text-align:center;width:60px">Status</th>
          <th style="padding:8px;color:#71717a;font-size:12px;text-align:left">Test</th>
          <th style="padding:8px;color:#71717a;font-size:12px;text-align:center;width:240px">Screenshot</th>
        </tr>
      </thead>
      <tbody>${rows.map(row).join('')}</tbody>
    </table>
  </section>`;
}

const sectionHtml = Object.entries(groups)
  .map(([key, rows]) => section(key, rows))
  .join('');

const summaryColor = failed === 0 ? '#1a9e6e' : '#f97316';
const summaryIcon = failed === 0 ? '🎉' : '⚠️';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FitApp E2E Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f0f0f;
      color: #d4d4d8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 32px 24px;
      max-width: 960px;
      margin: 0 auto;
    }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 13px; color: #71717a; margin-bottom: 32px; }
    .summary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: ${summaryColor}22;
      border: 1px solid ${summaryColor}55;
      border-radius: 12px;
      padding: 12px 20px;
      margin-bottom: 40px;
      font-size: 15px;
      font-weight: 600;
      color: ${summaryColor};
    }
  </style>
</head>
<body>
  <h1>FitApp E2E Report</h1>
  <p class="meta">Generated ${new Date().toUTCString()}</p>

  <div class="summary">
    ${summaryIcon} ${passed} passed &nbsp;·&nbsp; ${skipped} skipped &nbsp;·&nbsp; ${failed} failed &nbsp;·&nbsp; ${all.length} total
  </div>

  ${sectionHtml}
</body>
</html>`;

fs.writeFileSync(OUT_FILE, html, 'utf8');
console.log(`\n📄 Report written: playwright-report/index.html`);
console.log(`   ${passed}/${all.length} passed`);

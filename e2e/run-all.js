/**
 * e2e/run-all.js
 * Runs fitapp-kg.js and fitapp-lbs.js sequentially regardless of individual exit codes,
 * then generates the unified HTML report.
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

fs.mkdirSync(path.join(ROOT, 'playwright-report', 'screenshots'), { recursive: true });

function run(script) {
  console.log('\n' + '═'.repeat(50));
  console.log('  Running: ' + script);
  console.log('═'.repeat(50));
  var result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    stdio: 'inherit',
    cwd: ROOT,
    env: process.env,
  });
  return result.status || 0;
}

var kg = run('fitapp-kg.js');
var lbs = run('fitapp-lbs.js');
run('report.js');

var overall = kg !== 0 || lbs !== 0 ? 1 : 0;
process.exit(overall);

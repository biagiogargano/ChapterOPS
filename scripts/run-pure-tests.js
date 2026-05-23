'use strict';

/**
 * Reusable pure-suite runner (no test framework).
 *
 * Compiles the lib TypeScript sources to a throwaway temp dir (CommonJS), then
 * requires every compiled test file under a small module-loader hook that (a) stubs the native
 * AsyncStorage module so node can load store chains, and (b) maps "@/lib/*" /
 * "@/*" path aliases to the compiled output. Each test file is dependency-free
 * and asserts via console + process.exit; we intercept exit codes and aggregate.
 *
 * Coverage is guarded: the run fails if any expected suite did not execute.
 * Usage:  node scripts/run-pure-tests.js   (wired as `npm run test:pure`)
 */

const { execFileSync } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const projRoot = process.cwd();
const toPosix  = p => p.split(path.sep).join('/');

// The suites that must run (matches the lib/*.test.ts set we maintain).
const EXPECTED = [
  'claimStatus', 'customTemplatesStore', 'eventOps', 'eventTemplates', 'generatedTasks',
  'identityResolution', 'initRoute', 'mockTasks', 'orgPreference', 'orgScope', 'positions',
  'routeTarget',
];

// ── 1. Temp build config ──────────────────────────────────────────────────────
const tmp     = fs.mkdtempSync(path.join(os.tmpdir(), 'chapterops-pure-'));
const outDir  = path.join(tmp, 'out');
const cfgPath = path.join(tmp, 'tsconfig.json');

fs.writeFileSync(cfgPath, JSON.stringify({
  compilerOptions: {
    target: 'ES2019',
    module: 'commonjs',
    moduleResolution: 'node',
    strict: true,
    jsx: 'react',
    esModuleInterop: true,
    skipLibCheck: true,
    noEmitOnError: false,
    outDir:   toPosix(outDir),
    rootDir:  toPosix(projRoot),
    baseUrl:  toPosix(projRoot),
    paths: { '@/*': ['./*'] },
  },
  include: [toPosix(path.join(projRoot, 'lib')) + '/**/*.ts'],
}, null, 2));

// ── 2. Compile ────────────────────────────────────────────────────────────────
// tsc may exit non-zero due to type-only issues in RN modules pulled in
// transitively (UMD React / __DEV__) that never affect the pure, type-only test
// outputs. We ignore the exit code and rely on the emitted JS + runtime asserts.
let tscJs;
try { tscJs = require.resolve('typescript/bin/tsc', { paths: [projRoot] }); }
catch (_) { tscJs = path.join(projRoot, 'node_modules', 'typescript', 'bin', 'tsc'); }

try { execFileSync(process.execPath, [tscJs, '-p', cfgPath], { stdio: 'ignore' }); }
catch (_) { /* ignore tsc exit code; emit still occurs */ }

const outLib = path.join(outDir, 'lib');
if (!fs.existsSync(outLib)) {
  console.error('pure tests: compilation produced no output at ' + outLib);
  process.exit(1);
}

// ── 3. Module loader hook ───────────────────────────────────────────────────
const Module   = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') {
    const store = {};
    // __esModule so TS's esModuleInterop __importDefault doesn't double-wrap it.
    return { __esModule: true, default: {
      getItem:    async k => (k in store ? store[k] : null),
      setItem:    async (k, v) => { store[k] = String(v); },
      removeItem: async k => { delete store[k]; },
    } };
  }
  if (request.startsWith('@/lib/')) return origLoad(path.join(outLib, request.slice('@/lib/'.length)), parent, isMain);
  if (request.startsWith('@/'))     return origLoad(path.join(outDir, request.slice(2)), parent, isMain);
  // Resolve real node_modules (e.g. react, imported by store version-hooks) from
  // the project root — the temp compile dir has no node_modules of its own.
  if (request === 'react' || request.startsWith('react/')) {
    try { return origLoad(require.resolve(request, { paths: [projRoot] }), parent, isMain); }
    catch { /* fall through */ }
  }
  return origLoad(request, parent, isMain);
};

// ── 4. Run every compiled test file ──────────────────────────────────────────
const testFiles = fs.readdirSync(outLib).filter(f => f.endsWith('.test.js')).sort();
let anyFail = false;
const ran        = [];
const realExit   = process.exit;
for (const f of testFiles) {
  ran.push(f.replace('.test.js', ''));
  process.exit = code => { if (code) anyFail = true; };   // intercept per-suite exit
  try { require(path.join(outLib, f)); }
  catch (e) { anyFail = true; console.error('THREW in ' + f + ': ' + ((e && e.stack) || e)); }
}
process.exit = realExit;

// ── 5. Coverage guard + cleanup ──────────────────────────────────────────────
const missing = EXPECTED.filter(n => !ran.includes(n));
if (missing.length) { anyFail = true; console.error('pure tests: missing expected suites: ' + missing.join(', ')); }

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* best effort */ }

console.log('\npure tests: ran ' + ran.length + ' suites — ' + (anyFail ? 'FAILED' : 'all passed'));
process.exit(anyFail ? 1 : 0);

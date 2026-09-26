import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

test('the existing main sidebar is the only theme control mount', () => {
  const mounts = [...sources('app'), ...sources('src')].flatMap(path =>
    [...readFileSync(path, 'utf8').matchAll(/<ThemeToggle\b/g)].map(() => path.replaceAll('\\', '/')));
  assert.deepEqual(mounts, ['app/page.tsx']);
  const home = readFileSync('app/page.tsx', 'utf8');
  assert.match(home, /className="sidebar-bottom"[^\n]*<ThemeToggle\/>/);
});

test('theme initialization and persistence stay in the shared root system', () => {
  const layout = readFileSync('app/layout.tsx', 'utf8');
  const shared = readFileSync('src/components/site-enhancements.tsx', 'utf8');
  assert.match(layout, /localStorage\.getItem\('home-foods-theme'\)/);
  assert.match(layout, /<SiteEnhancements\s*\/>/);
  assert.match(shared, /localStorage\.setItem\("home-foods-theme", next\)/);
  assert.match(shared, /window\.addEventListener\("storage", applyTheme\)/);
});

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Extends the honest-language policy (bannedWords.test.ts) from i18n/en.json to
 * the UI source itself: pages, components and mock fixtures shown in demos.
 */
const ROOT = join(__dirname, '..', '..');
const DIRS = ['pages', 'components', 'mocks'];
const BANNED = /\b(fraud\w*|forged|fake\w*)\b/i;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|json)$/.test(name) ? [p] : [];
  });

describe('Honest language policy in UI source', () => {
  it('UI source and demo fixtures do not use the words fraud, forged or fake', () => {
    const offenders = DIRS.flatMap((d) => walk(join(ROOT, d))).filter((f) => BANNED.test(readFileSync(f, 'utf8')));
    expect(offenders, `Banned wording found in: ${offenders.join(', ')}`).toEqual([]);
  });
});

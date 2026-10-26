import { describe, it, expect } from 'vitest';
import enStrings from '../../i18n/en.json';

describe('Regulatory Honest Language Policy', () => {
  const bannedWords = ['fraud', 'forged', 'fake'];

  it('fails build if i18n/en.json strings contain banned words (fraud, forged, fake)', () => {
    const jsonString = JSON.stringify(enStrings).toLowerCase();

    bannedWords.forEach((word) => {
      // Check word boundary or substring
      const containsBanned = jsonString.includes(word);
      expect(
        containsBanned,
        `Prohibited regulatory word "${word}" found in i18n/en.json strings! Use "possible anomaly", "needs verification", or "mismatch detected".`
      ).toBe(false);
    });
  });
});

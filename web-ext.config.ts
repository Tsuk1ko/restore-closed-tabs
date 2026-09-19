import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineWebExtConfig } from 'wxt';

const chromiumProfile = resolve('.wxt/chrome-data');
mkdirSync(chromiumProfile, { recursive: true });

export default defineWebExtConfig({
  chromiumProfile,
  keepProfileChanges: true,
});

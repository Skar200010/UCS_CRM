// Credentials the panel writes into the settings table. No network, no DB:
// these are the rules that decide whether a saved token is applied, masked or
// quietly ignored.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  META_CONFIG_FIELDS,
  applyMetaEnvPatch,
  maskSecret,
} from './metaAdsConfigStore.js';

test('secret previews never expose the full credential', () => {
  assert.equal(maskSecret('EAAWR1WP6XocBSxhK8dGRXUsZAbvAynlWyb0J7'), 'EAAW…b0J7');
  assert.equal(maskSecret('short'), '•••••');
  assert.equal(maskSecret(''), '');
  // A masked value must not contain the middle of the original token.
  assert.doesNotMatch(maskSecret('metaucs2014'), /ucs20/);
});

test('only whitelisted Meta keys reach process.env', () => {
  const snapshot = {
    META_ADS_APP_ID: process.env.META_ADS_APP_ID,
    META_ADS_ACCESS_TOKEN: process.env.META_ADS_ACCESS_TOKEN,
    PATH: process.env.PATH,
  };

  try {
    applyMetaEnvPatch({ META_ADS_APP_ID: ' 1831289661201002 ', META_ADS_ACCESS_TOKEN: 'EAAabc', PATH: '/evil' });
    assert.equal(process.env.META_ADS_APP_ID, '1831289661201002');
    assert.equal(process.env.META_ADS_ACCESS_TOKEN, 'EAAabc');
    assert.equal(process.env.PATH, snapshot.PATH);

    // Clearing a value must also remove the in-memory copy: otherwise the panel
    // says "cleared" while the poller keeps using the old token.
    applyMetaEnvPatch({ META_ADS_ACCESS_TOKEN: '' });
    assert.equal(process.env.META_ADS_ACCESS_TOKEN, undefined);
  } finally {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('the verify token is deliberately not panel-editable', () => {
  assert.equal(META_CONFIG_FIELDS.includes('META_ADS_VERIFY_TOKEN'), false);
  assert.deepEqual(META_CONFIG_FIELDS, [
    'META_ADS_ACCESS_TOKEN',
    'META_ADS_APP_SECRET',
    'META_ADS_APP_ID',
    'META_ADS_AD_ACCOUNT_ID',
    'META_ADS_PAGE_ID',
    'META_ADS_API_VERSION',
  ]);
});

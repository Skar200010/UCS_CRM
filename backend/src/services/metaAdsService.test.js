// Pure helpers behind Meta Lead Ads. No network, no database: these are the
// decisions that silently drop or mis-tag a paid lead if they regress.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  mapLeadFields,
  metaLeadCount,
  normalizeAdAccountId,
  normalizePhone,
  verifyMetaSignature,
} from './metaAdsService.js';
import { buildMetaLeadNotes } from './metaLeadIngestService.js';

test('field_data is flattened into the CRM name/phone/email fields', () => {
  const mapped = mapLeadFields({
    field_data: [
      { name: 'full_name', values: ['Asha Verma'] },
      { name: 'phone_number', values: ['+91 98765 43210'] },
      { name: 'email', values: ['asha@example.com'] },
      { name: 'city', values: ['Jaipur'] },
      { name: 'donation_amount', values: ['₹5,000'] },
    ],
  });
  assert.equal(mapped.name, 'Asha Verma');
  assert.equal(mapped.phone, '919876543210');
  assert.equal(mapped.email, 'asha@example.com');
  assert.equal(mapped.city, 'Jaipur');
  assert.equal(mapped.fields.donation_amount, '₹5,000');
});

test('first + last name is used when full_name is absent', () => {
  const mapped = mapLeadFields({
    field_data: [
      { name: 'first_name', values: ['Asha'] },
      { name: 'last_name', values: ['Verma'] },
    ],
  });
  assert.equal(mapped.name, 'Asha Verma');
});

test('custom form field names still map a phone and name', () => {
  const mapped = mapLeadFields({
    field_data: [
      { name: 'Your Name', values: ['Asha Verma'] },
      { name: 'WhatsApp No.', values: ['+91 98765 43210'] },
    ],
  });
  assert.equal(mapped.name, 'Asha Verma');
  assert.equal(mapped.phone, '919876543210');
});

test('phone normalisation keeps country code and strips formatting', () => {
  assert.equal(normalizePhone('+91 (98765)-43210'), '919876543210');
  assert.equal(normalizePhone('09876543210'), '9876543210');
  assert.equal(normalizePhone(''), '');
});

test('meta lead actions are not double-counted across action types', () => {
  assert.equal(metaLeadCount([
    { action_type: 'lead', value: '5' },
    { action_type: 'onsite_conversion.lead_grouped', value: '5' },
    { action_type: 'link_click', value: '40' },
  ]), 5);
  assert.equal(metaLeadCount([{ action_type: 'lead', value: '3' }]), 3);
  assert.equal(metaLeadCount([{ action_type: 'offsite_conversion.fb_pixel_lead', value: '9' }]), 0);
  assert.equal(metaLeadCount([]), 0);
});

test('ad account ids accept the act_ prefix', () => {
  assert.equal(normalizeAdAccountId('act_123456'), '123456');
  assert.equal(normalizeAdAccountId('123456'), '123456');
  assert.equal(normalizeAdAccountId(''), '');
});

test('webhook signatures are verified with the app secret', () => {
  const body = JSON.stringify({ object: 'page' });
  const secret = 'test-secret';
  const valid = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  assert.equal(verifyMetaSignature(body, valid, secret), true);
  assert.equal(verifyMetaSignature(body, 'sha256=deadbeef', secret), false);
  assert.equal(verifyMetaSignature(body, valid, ''), false);
  assert.equal(verifyMetaSignature(`${body} `, valid, secret), false);
});

test('notes carry the mapped [Account:] tag for the SS station resolver', () => {
  const lead = {
    id: '987654321',
    platform: 'facebook',
    campaign_id: 'camp-1',
    campaign_name: 'Winter Donation',
    form_id: 'form-1',
    field_data: [
      { name: 'full_name', values: ['Asha Verma'] },
      { name: 'phone_number', values: ['9876543210'] },
      { name: 'city', values: ['Jaipur'] },
      { name: 'preferred_time', values: ['Evening'] },
    ],
  };
  const mapped = buildMetaLeadNotes(lead, { ngo: 'BSCT', account: 'bsct' });
  assert.match(mapped, /\[Account: bsct\]/);
  assert.match(mapped, /\[Campaign: Winter Donation\]/);
  assert.match(mapped, /\[Platform: facebook\]/);
  assert.match(mapped, /City: Jaipur/);
  assert.match(mapped, /Preferred Time: Evening/);
  assert.doesNotMatch(mapped, /Full Name:/);
  assert.doesNotMatch(mapped, /Phone Number:/);
});

test('an unmapped form still produces a usable note without [Account:]', () => {
  const notes = buildMetaLeadNotes({ id: '1', form_id: 'form-x', field_data: [] }, null);
  assert.doesNotMatch(notes, /\[Account:/);
  assert.match(notes, /\[Meta Lead: 1\]/);
});

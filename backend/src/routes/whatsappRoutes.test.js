// The WhatsApp Center's "Bulk send" tab (and the tabs around it) call the
// endpoints below by name. They were dropped from this router once already
// while the controller kept the handlers, so the UI failed with 404s instead of
// sending. Pin the routes so that cannot happen silently again.

import test from 'node:test';
import assert from 'node:assert/strict';

import router from './whatsappRoutes.js';

const registered = new Set(
  router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map(
        (method) => `${method.toUpperCase()} ${layer.route.path}`,
      ),
    ),
);

test('Bulk send and its supporting endpoints stay mounted', () => {
  const required = [
    // Template picker.
    ['GET', '/templates'],
    // Sending and pre-flight validation.
    ['POST', '/send-bulk-template'],
    ['POST', '/validate-contacts'],
    // Delivery log / failure banner.
    ['GET', '/bulk/statuses'],
    // "Station / Donor" recipient mode.
    ['GET', '/bulk/ngos'],
    ['GET', '/bulk/stations'],
    ['GET', '/bulk/donors-by-station'],
    // Campaign rows created before a bulk send.
    ['POST', '/campaigns'],
    ['GET', '/campaigns'],
    ['GET', '/campaigns/:id'],
    // Background campaign progress / controls.
    ['GET', '/campaigns/:id/progress'],
    ['POST', '/campaigns/:id/cancel'],
    ['POST', '/campaigns/:id/resume'],
    // Account health card.
    ['GET', '/accounts/:accountId/health'],
  ];

  for (const [method, path] of required) {
    assert.ok(
      registered.has(`${method} ${path}`),
      `missing route: ${method} /api/whatsapp${path}`,
    );
  }
});

test('Chats tab endpoints stay mounted', () => {
  const required = [
    ['GET', '/chats'],
    ['POST', '/chats/:phone/read'],
    ['GET', '/conversations/:phone'],
    ['POST', '/send-text'],
    ['POST', '/send-media'],
  ];

  for (const [method, path] of required) {
    assert.ok(
      registered.has(`${method} ${path}`),
      `missing route: ${method} /api/whatsapp${path}`,
    );
  }
});

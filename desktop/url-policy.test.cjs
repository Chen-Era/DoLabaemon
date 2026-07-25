'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DEFAULT_PRODUCTION_URL,
  isSafeExternalUrl,
  isSameOriginNavigation,
  resolveServerUrl,
} = require('./url-policy.cjs');

test('packaged client defaults to the approved HTTPS service', () => {
  const url = resolveServerUrl({
    isPackaged: true,
    environment: {},
    argv: ['electron'],
  });

  assert.equal(url.href, `${DEFAULT_PRODUCTION_URL}/`);
});

test('packaged client rejects insecure and credential-bearing server URLs', () => {
  assert.throws(
    () =>
      resolveServerUrl({
        isPackaged: true,
        environment: { DORLABAEMON_SERVER_URL: 'http://example.test' },
        argv: ['electron'],
      }),
    /Only HTTPS server URLs/,
  );

  assert.throws(
    () =>
      resolveServerUrl({
        isPackaged: true,
        environment: { DORLABAEMON_SERVER_URL: 'https://user:pass@example.test' },
        argv: ['electron'],
      }),
    /must not contain credentials/,
  );
});

test('development client allows only loopback HTTP and honours command-line priority', () => {
  const localUrl = resolveServerUrl({
    isPackaged: false,
    environment: { DORLABAEMON_DEV_URL: 'http://localhost:3100' },
    argv: ['electron'],
  });
  assert.equal(localUrl.href, 'http://localhost:3100/');

  const commandLineUrl = resolveServerUrl({
    isPackaged: false,
    environment: { DORLABAEMON_DEV_URL: 'http://localhost:3100' },
    argv: ['electron', '--server-url=https://staging.example.test'],
  });
  assert.equal(commandLineUrl.href, 'https://staging.example.test/');

  assert.throws(
    () =>
      resolveServerUrl({
        isPackaged: false,
        environment: { DORLABAEMON_DEV_URL: 'http://example.test' },
        argv: ['electron'],
      }),
    /Only HTTPS URLs or HTTP localhost URLs/,
  );
});

test('navigation helpers retain the trusted origin and restrict external schemes', () => {
  const trustedUrl = new URL(DEFAULT_PRODUCTION_URL);
  assert.equal(
    isSameOriginNavigation('https://dorlabaemon.era.ac.cn/dashboard', trustedUrl),
    true,
  );
  assert.equal(isSameOriginNavigation('https://example.test/', trustedUrl), false);
  assert.equal(isSafeExternalUrl('https://example.test/docs'), true);
  assert.equal(isSafeExternalUrl('file:///private/secret'), false);
  assert.equal(isSafeExternalUrl('https://user:pass@example.test'), false);
});

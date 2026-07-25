'use strict';

/**
 * URL policy shared by the Electron main process and its tests. Keeping this
 * outside the renderer ensures that a remotely served page cannot weaken the
 * trusted-origin boundary.
 */
const DEFAULT_PRODUCTION_URL = 'https://dorlabaemon.era.ac.cn';
const DEFAULT_DEVELOPMENT_URL = 'http://127.0.0.1:3000';

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1'
  );
}

function readServerUrlArgument(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument.startsWith('--server-url=')) {
      return argument.slice('--server-url='.length);
    }

    if (argument === '--server-url') {
      return argv[index + 1];
    }
  }

  return undefined;
}

function validateServerUrl(value, { allowLocalHttp }) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('A server URL must be provided.');
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('The server URL is not a valid absolute URL.');
  }

  if (url.username || url.password) {
    throw new Error('The server URL must not contain credentials.');
  }

  if (url.protocol === 'https:') {
    return url;
  }

  if (
    allowLocalHttp &&
    url.protocol === 'http:' &&
    isLoopbackHostname(url.hostname)
  ) {
    return url;
  }

  throw new Error(
    allowLocalHttp
      ? 'Only HTTPS URLs or HTTP localhost URLs are permitted in development.'
      : 'Only HTTPS server URLs are permitted in packaged builds.',
  );
}

function resolveServerUrl({ isPackaged, environment = process.env, argv = process.argv }) {
  const commandLineUrl = readServerUrlArgument(argv);
  const configuredUrl = commandLineUrl || environment.DORLABAEMON_SERVER_URL;

  if (isPackaged) {
    return validateServerUrl(configuredUrl || DEFAULT_PRODUCTION_URL, {
      allowLocalHttp: false,
    });
  }

  return validateServerUrl(
    commandLineUrl ||
      environment.DORLABAEMON_DEV_URL ||
      configuredUrl ||
      DEFAULT_DEVELOPMENT_URL,
    { allowLocalHttp: true },
  );
}

function isSameOriginNavigation(candidateUrl, trustedUrl) {
  try {
    return new URL(candidateUrl).origin === trustedUrl.origin;
  } catch {
    return false;
  }
}

function isSafeExternalUrl(candidateUrl) {
  try {
    const url = new URL(candidateUrl);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

module.exports = {
  DEFAULT_DEVELOPMENT_URL,
  DEFAULT_PRODUCTION_URL,
  isLoopbackHostname,
  isSafeExternalUrl,
  isSameOriginNavigation,
  readServerUrlArgument,
  resolveServerUrl,
  validateServerUrl,
};

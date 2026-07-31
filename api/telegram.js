const crypto = require('crypto');

const TELEGRAM_ISSUER = 'https://oauth.telegram.org';
const TELEGRAM_AUTH_URL = `${TELEGRAM_ISSUER}/auth`;
const TELEGRAM_TOKEN_URL = `${TELEGRAM_ISSUER}/token`;
const TELEGRAM_JWKS_URL =
  `${TELEGRAM_ISSUER}/.well-known/jwks.json`;

const DEFAULT_SITE_URL = 'https://khmer-together.vercel.app';
const COOKIE_MAX_AGE_SECONDS = 10 * 60;

let cachedJwks = null;
let cachedJwksExpiresAt = 0;

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function randomValue(bytes = 32) {
  return base64Url(crypto.randomBytes(bytes));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function safeEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index < 0) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function authCookie(name, value, maxAge = COOKIE_MAX_AGE_SECONDS) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/api/telegram',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax'
  ].join('; ');
}

function clearAuthCookies(res) {
  res.setHeader('Set-Cookie', [
    authCookie('kt_tg_state', '', 0),
    authCookie('kt_tg_verifier', '', 0),
    authCookie('kt_tg_nonce', '', 0)
  ]);
}

function redirect(res, location, statusCode = 302) {
  res.statusCode = statusCode;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', location);
  res.end();
}

function redirectWithError(res, siteUrl, error) {
  clearAuthCookies(res);
  const message =
    error instanceof Error ? error.message : String(error || 'Unknown error');
  const safeMessage = message
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 180);
  redirect(
    res,
    `${siteUrl}/?telegram_error=${encodeURIComponent(safeMessage)}`
  );
}

function requiredEnvironment() {
  const siteUrl = (
    process.env.PUBLIC_SITE_URL ||
    DEFAULT_SITE_URL
  ).replace(/\/+$/, '');

  const callbackUrl =
    process.env.TELEGRAM_REDIRECT_URI ||
    `${siteUrl}/api/telegram`;

  const values = {
    siteUrl,
    callbackUrl,
    telegramClientId: process.env.TELEGRAM_CLIENT_ID,
    telegramClientSecret: process.env.TELEGRAM_CLIENT_SECRET,
    supabaseUrl: (
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      ''
    ).replace(/\/+$/, ''),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };

  const missing = Object.entries(values)
    .filter(([key, value]) =>
      !value && !['siteUrl', 'callbackUrl'].includes(key)
    )
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(
      `Missing secure Vercel environment variables: ${missing.join(', ')}`
    );
  }

  return values;
}

async function getTelegramJwks() {
  if (cachedJwks && Date.now() < cachedJwksExpiresAt) {
    return cachedJwks;
  }

  const response = await fetch(TELEGRAM_JWKS_URL, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error('Telegram signing keys could not be loaded.');
  }

  const data = await response.json();
  if (!Array.isArray(data.keys)) {
    throw new Error('Telegram returned invalid signing keys.');
  }

  cachedJwks = data.keys;
  cachedJwksExpiresAt = Date.now() + 60 * 60 * 1000;
  return cachedJwks;
}

function decodeJwtPart(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function verifyTelegramIdToken(idToken, clientId, expectedNonce) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) {
    throw new Error('Telegram returned an invalid identity token.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJwtPart(encodedHeader);
  const payload = decodeJwtPart(encodedPayload);

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Telegram used an unsupported signing key.');
  }

  const keys = await getTelegramJwks();
  const jwk = keys.find(key => key.kid === header.kid);
  if (!jwk) {
    cachedJwks = null;
    cachedJwksExpiresAt = 0;
    const refreshedKeys = await getTelegramJwks();
    const refreshedJwk = refreshedKeys.find(key => key.kid === header.kid);
    if (!refreshedJwk) {
      throw new Error('Telegram signing key was not found.');
    }
    return verifyTelegramIdTokenWithKey(
      parts,
      payload,
      refreshedJwk,
      clientId,
      expectedNonce
    );
  }

  return verifyTelegramIdTokenWithKey(
    parts,
    payload,
    jwk,
    clientId,
    expectedNonce
  );
}

function verifyTelegramIdTokenWithKey(
  parts,
  payload,
  jwk,
  clientId,
  expectedNonce
) {
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const publicKey = crypto.createPublicKey({
    key: jwk,
    format: 'jwk'
  });
  const validSignature = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    Buffer.from(encodedSignature, 'base64url')
  );

  if (!validSignature) {
    throw new Error('Telegram identity verification failed.');
  }

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud)
    ? payload.aud.map(String)
    : [String(payload.aud || '')];

  if (payload.iss !== TELEGRAM_ISSUER) {
    throw new Error('Telegram returned an invalid issuer.');
  }
  if (!audiences.includes(String(clientId))) {
    throw new Error('Telegram returned an invalid audience.');
  }
  if (!payload.exp || Number(payload.exp) <= now) {
    throw new Error('Telegram login expired. Please try again.');
  }
  if (payload.iat && Number(payload.iat) > now + 300) {
    throw new Error('Telegram returned an invalid login time.');
  }
  if (!safeEqual(payload.nonce, expectedNonce)) {
    throw new Error('Telegram login nonce did not match.');
  }
  if (!payload.sub) {
    throw new Error('Telegram did not return a user identifier.');
  }

  return payload;
}

async function exchangeTelegramCode({
  code,
  codeVerifier,
  callbackUrl,
  clientId,
  clientSecret
}) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
    client_id: String(clientId),
    code_verifier: codeVerifier
  });

  const basicAuthorization = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString('base64');

  const response = await fetch(TELEGRAM_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basicAuthorization}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id_token) {
    throw new Error(
      data.error_description ||
      data.error ||
      'Telegram could not finish the login.'
    );
  }

  return data;
}

function telegramEmail(claims) {
  const identifier = String(claims.sub)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 48);

  if (!identifier) {
    throw new Error('Telegram returned an invalid user identifier.');
  }

  return `telegram_${identifier}@khmer-together.vercel.app`;
}

async function createSupabaseLoginToken({
  supabaseUrl,
  serviceRoleKey,
  siteUrl,
  claims
}) {
  const email = telegramEmail(claims);
  const metadata = {
    auth_source: 'telegram',
    telegram_sub: String(claims.sub),
    telegram_id: claims.id || null,
    telegram_username: claims.preferred_username || null,
    preferred_username: claims.preferred_username || null,
    full_name: claims.name || 'Khmer Together Member',
    name: claims.name || 'Khmer Together Member',
    avatar_url: claims.picture || null,
    picture: claims.picture || null
  };

  const response = await fetch(
    `${supabaseUrl}/auth/v1/admin/generate_link`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'magiclink',
        email,
        data: metadata,
        redirect_to: siteUrl
      })
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.hashed_token) {
    throw new Error(
      data.msg ||
      data.message ||
      data.error_description ||
      'Supabase could not create the Telegram session.'
    );
  }

  return data.hashed_token;
}

async function beginTelegramLogin(req, res, env) {
  const state = randomValue();
  const codeVerifier = randomValue(48);
  const nonce = randomValue();
  const codeChallenge = base64Url(sha256(codeVerifier));

  res.setHeader('Set-Cookie', [
    authCookie('kt_tg_state', state),
    authCookie('kt_tg_verifier', codeVerifier),
    authCookie('kt_tg_nonce', nonce)
  ]);

  const authorizationUrl = new URL(TELEGRAM_AUTH_URL);
  authorizationUrl.searchParams.set(
    'client_id',
    String(env.telegramClientId)
  );
  authorizationUrl.searchParams.set(
    'redirect_uri',
    env.callbackUrl
  );
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'openid profile');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set(
    'code_challenge',
    codeChallenge
  );
  authorizationUrl.searchParams.set(
    'code_challenge_method',
    'S256'
  );
  authorizationUrl.searchParams.set('nonce', nonce);

  redirect(res, authorizationUrl.toString());
}

async function finishTelegramLogin(req, res, env, requestUrl) {
  const providerError = requestUrl.searchParams.get('error');
  if (providerError) {
    throw new Error(
      requestUrl.searchParams.get('error_description') ||
      providerError
    );
  }

  const code = requestUrl.searchParams.get('code');
  const returnedState = requestUrl.searchParams.get('state');
  const cookies = parseCookies(req.headers.cookie || '');

  if (!code) {
    throw new Error('Telegram did not return an authorization code.');
  }
  if (!safeEqual(returnedState, cookies.kt_tg_state)) {
    throw new Error('Telegram login state did not match.');
  }
  if (!cookies.kt_tg_verifier || !cookies.kt_tg_nonce) {
    throw new Error('Telegram login expired. Please start again.');
  }

  const tokens = await exchangeTelegramCode({
    code,
    codeVerifier: cookies.kt_tg_verifier,
    callbackUrl: env.callbackUrl,
    clientId: env.telegramClientId,
    clientSecret: env.telegramClientSecret
  });

  const claims = await verifyTelegramIdToken(
    tokens.id_token,
    env.telegramClientId,
    cookies.kt_tg_nonce
  );

  const tokenHash = await createSupabaseLoginToken({
    supabaseUrl: env.supabaseUrl,
    serviceRoleKey: env.serviceRoleKey,
    siteUrl: env.siteUrl,
    claims
  });

  clearAuthCookies(res);
  redirect(
    res,
    `${env.siteUrl}/#telegram_token_hash=${encodeURIComponent(tokenHash)}`
  );
}

module.exports = async function telegramHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  let env;
  try {
    env = requiredEnvironment();
  } catch (error) {
    redirectWithError(res, DEFAULT_SITE_URL, error);
    return;
  }

  const requestUrl = new URL(req.url, env.siteUrl);
  const isCallback =
    requestUrl.searchParams.has('code') ||
    requestUrl.searchParams.has('error');

  try {
    if (isCallback) {
      await finishTelegramLogin(req, res, env, requestUrl);
    } else {
      await beginTelegramLogin(req, res, env);
    }
  } catch (error) {
    redirectWithError(res, env.siteUrl, error);
  }
};

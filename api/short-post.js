import crypto from 'node:crypto';

const CODE_PATTERN = /^[A-Za-z0-9_-]{8}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function config() {
  return {
    url: requireEnv('SUPABASE_URL').replace(/\/+$/, ''),
    key: requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  };
}

async function supabaseRequest(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store'
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = text; }
  }

  return { ok: response.ok, status: response.status, data };
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function findByPostId(postId) {
  const query = new URLSearchParams({
    select: 'code,post_id',
    post_id: `eq.${postId}`,
    limit: '1'
  });
  const result = await supabaseRequest(`kt_post_short_links?${query}`);
  if (!result.ok) throw new Error('Unable to read the short-link table.');
  return Array.isArray(result.data) && result.data.length ? result.data[0] : null;
}

async function findByCode(code) {
  const query = new URLSearchParams({
    select: 'code,post_id',
    code: `eq.${code}`,
    limit: '1'
  });
  const result = await supabaseRequest(`kt_post_short_links?${query}`);
  if (!result.ok) throw new Error('Unable to resolve the short link.');
  return Array.isArray(result.data) && result.data.length ? result.data[0] : null;
}

async function postExists(postId) {
  const query = new URLSearchParams({
    select: 'id',
    id: `eq.${postId}`,
    limit: '1'
  });
  const result = await supabaseRequest(`kt_posts?${query}`);
  if (!result.ok) throw new Error('Unable to verify the post.');
  return Array.isArray(result.data) && result.data.length > 0;
}

function newCode() {
  // Six random bytes become exactly eight URL-safe characters.
  return crypto.randomBytes(6).toString('base64url');
}

async function createOrGetCode(postId) {
  const existing = await findByPostId(postId);
  if (existing?.code) return existing.code;

  if (!(await postExists(postId))) return null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = newCode();
    const result = await supabaseRequest('kt_post_short_links', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: { code, post_id: postId }
    });

    if (result.ok) return code;

    // A simultaneous request may have created the post's code first.
    if (result.status === 409) {
      const winner = await findByPostId(postId);
      if (winner?.code) return winner.code;
      continue;
    }

    throw new Error('Unable to create the short link.');
  }

  throw new Error('Unable to allocate a unique short code.');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const base = `https://${req.headers.host || 'khmer-together.vercel.app'}`;
    const url = new URL(req.url || '/', base);
    const code = String(url.searchParams.get('code') || '').trim();

    if (code) {
      if (!CODE_PATTERN.test(code)) {
        res.statusCode = 404;
        return res.end('Short link not found.');
      }

      const row = await findByCode(code);
      if (!row?.post_id) {
        res.statusCode = 404;
        return res.end('This post link is no longer available.');
      }

      res.statusCode = 302;
      res.setHeader('Location', `/p/${encodeURIComponent(row.post_id)}`);
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.end();
    }

    const postId = String(url.searchParams.get('post_id') || '').trim();
    if (!UUID_PATTERN.test(postId)) {
      return sendJson(res, 400, { error: 'Invalid post ID.' });
    }

    const shortCode = await createOrGetCode(postId);
    if (!shortCode) {
      return sendJson(res, 404, { error: 'Post not found.' });
    }

    return sendJson(res, 200, {
      ok: true,
      code: shortCode,
      path: `/s/${shortCode}`
    });
  } catch (error) {
    console.error('short-post error', error?.message || error);
    return sendJson(res, 500, { error: 'Unable to create the short post link.' });
  }
}

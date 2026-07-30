export default function handler(request, response) {
  const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();

  response.setHeader('Cache-Control', 'no-store');

  if (!key.startsWith('sb_publishable_')) {
    return response.status(500).json({
      error: 'SUPABASE_PUBLISHABLE_KEY is missing or invalid in Vercel.'
    });
  }

  return response.status(200).json({
    url: 'https://hgbtvhjnjmptxvlaotwu.supabase.co',
    key
  });
}

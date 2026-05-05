// api/proxy.js
export const config = { runtime: 'edge' };

const SMN_WHITELIST = 'https://smn.conagua.gob.mx';

export default async function handler(req) {
  const targetUrl = new URL(req.url).searchParams.get('url');
  
  if (!targetUrl?.startsWith(SMN_WHITELIST)) {
    return new Response('Dominio no permitido', { status: 403 });
  }

  const res = await fetch(targetUrl, { 
    headers: { 'User-Agent': 'SMN-Pilot/1.0' } 
  });
  
  const text = await res.text();
  
  return new Response(text, {
    status: res.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800' // 15 min
    }
  });
}

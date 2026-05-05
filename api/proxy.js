// api/proxy.js
export const config = { runtime: 'edge' };

const SMN_WHITELIST = 'https://smn-api.serviciometeorologico.gob.mx'; // Ajusta si el dominio real es distinto

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
      'Content-Type': res.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
    }
  });
}

// api/proxy.js
export const config = { runtime: 'edge' };

const SMN_WHITELIST = 'https://smn.conagua.gob.mx';

export default async function handler(req) {
  const targetUrl = new URL(req.url).searchParams.get('url');
  
  // Validación de dominio
  try {
    const parsed = new URL(targetUrl);
    if (parsed.origin !== SMN_WHITELIST) {
      return new Response('Dominio no permitido', { status: 403 });
    }
  } catch {
    return new Response('URL inválida', { status: 400 });
  }

  // Petición al SMN SIN forzar encoding que interfiera con gzip
  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      // NO agregamos Accept-Encoding: Vercel Edge maneja gzip automáticamente
    }
  });
  
  // Obtener el cuerpo como texto (Vercel descomprime automáticamente)
  const text = await res.text();
  
  // Validar que sea JSON válido antes de enviar
  try {
    JSON.parse(text); // Solo para validar, no guardamos el resultado
  } catch (e) {
    // Si no es JSON, podría ser HTML de error del SMN
    console.error('Respuesta no JSON del SMN:', text.slice(0, 200));
  }
  
  return new Response(text, {
    status: res.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800'
    }
  });
}

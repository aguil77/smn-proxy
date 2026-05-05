// api/proxy.js - Node.js Runtime con manejo robusto de errores
const SMN_WHITELIST = 'https://smn.conagua.gob.mx';

// Headers que simulan un navegador real para evitar bloqueo
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=900');

  // Preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = req.query?.url;
  
  // Validar dominio
  if (!targetUrl?.startsWith(SMN_WHITELIST)) {
    return res.status(403).json({ error: 'Dominio no permitido' });
  }

  // Reintentos en caso de fallo temporal
  const MAX_RETRIES = 2;
  let lastError;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Proxy] Intento ${attempt + 1} para: ${targetUrl}`);
      
      const response = await fetch(targetUrl, {
        headers: BROWSER_HEADERS,
        // Timeout de 15 segundos
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      
      // Validar JSON
      try {
        JSON.parse(text);
      } catch (e) {
        console.warn('[Proxy] Respuesta no JSON:', text.substring(0, 100));
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      console.log('[Proxy] Éxito - Respuesta enviada');
      return res.status(response.status).send(text);
      
    } catch (error) {
      lastError = error;
      console.error(`[Proxy] Error en intento ${attempt + 1}:`, error.message);
      
      // Esperar antes de reintentar (exponential backoff)
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  console.error('[Proxy] Todos los intentos fallaron:', lastError?.message);
  
  // Respuesta de error detallada para debugging
  return res.status(502).json({ 
    error: 'fetch failed', 
    message: lastError?.message || 'Error desconocido',
    url: targetUrl,
    tip: 'Verifica que el endpoint del SMN esté accesible públicamente'
  });
}

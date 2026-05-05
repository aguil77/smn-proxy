// api/proxy.js - CORS definitivo + manejo de preflight
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gunzip = promisify(zlib.gunzip);
const SMN_WHITELIST = 'https://smn.conagua.gob.mx';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': '*/*',
  'Accept-Language': 'es-MX,es;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive'
};

export default async function handler(req, res) {
  // ✅ CORS HEADERS - Siempre se envían, incluso en error
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache de preflight: 24h
  res.setHeader('Cache-Control', 'public, max-age=900');

  // ✅ Manejo explícito de preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(204).end(); // 204 = No Content (respuesta válida para preflight)
  }

  // Parsear URL con WHATWG API (sin deprecación)
  const { searchParams } = new URL(req.url, `https://${req.headers.host}`);
  const targetUrl = searchParams.get('url');
  
  if (!targetUrl?.startsWith(SMN_WHITELIST)) {
    return res.status(403).json({ error: 'Dominio no permitido' });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(45000)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let jsonText;
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      const decompressed = await gunzip(buffer);
      jsonText = decompressed.toString('utf-8');
    } else {
      jsonText = buffer.toString('utf-8');
    }

    const jsonData = JSON.parse(jsonText);
    
    // ✅ Asegurar Content-Type correcto
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(jsonData);
    
  } catch (error) {
    console.error('[Proxy] Error:', error.message);
    // ✅ Incluir CORS headers incluso en respuesta de error
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(502).json({ 
      error: 'fetch failed', 
      message: error.message 
    });
  }
}

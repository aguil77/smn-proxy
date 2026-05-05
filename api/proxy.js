// api/proxy.js - Node.js 24.x compatible
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gunzip = promisify(zlib.gunzip);
const SMN_WHITELIST = 'https://smn.conagua.gob.mx';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=900');

  // Preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  const targetUrl = req.query?.url;
  
  if (!targetUrl?.startsWith(SMN_WHITELIST)) {
    return res.status(403).json({ error: 'Dominio no permitido' });
  }

  try {
    console.log('[Proxy] Fetching:', targetUrl);
    
    const response = await fetch(targetUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': '*/*'
      },
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log('[Proxy] Bytes:', buffer.length, '| Magic:', buffer.slice(0,2).toString('hex'));

    let jsonText;
    
    // Detectar y descomprimir gzip
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      console.log('[Proxy] Descomprimiendo GZIP...');
      const decompressed = await gunzip(buffer);
      jsonText = decompressed.toString('utf-8');
    } else {
      jsonText = buffer.toString('utf-8');
    }

    // Parsear y validar JSON
    const jsonData = JSON.parse(jsonText);
    console.log('[Proxy] ✅ JSON válido');
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(jsonData);
    
  } catch (error) {
    console.error('[Proxy] ❌ Error:', error.message);
    return res.status(502).json({ 
      error: 'fetch failed', 
      message: error.message,
      url: targetUrl
    });
  }
}

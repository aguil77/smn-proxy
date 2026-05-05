// api/proxy.js - Node.js Runtime con descompresión gzip/deflate
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const SMN_WHITELIST = 'https://smn.conagua.gob.mx';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=900');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const targetUrl = req.query?.url;
  
  if (!targetUrl?.startsWith(SMN_WHITELIST)) {
    return res.status(403).json({ error: 'Dominio no permitido' });
  }

  try {
    console.log('[Proxy] Descargando:', targetUrl);
    
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': '*/*',
      },
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log('[Proxy] Bytes recibidos:', buffer.length);
    console.log('[Proxy] Magic bytes:', buffer.slice(0, 4).toString('hex'));

    let jsonText;

    // Detectar y descomprimir según el tipo
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      // Gzip
      console.log('[Proxy] Detectado GZIP, descomprimiendo...');
      const decompressed = await gunzip(buffer);
      jsonText = decompressed.toString('utf-8');
    } else if (buffer[0] === 0x78) {
      // Deflate
      console.log('[Proxy] Detectado DEFLATE, descomprimiendo...');
      const decompressed = await inflate(buffer);
      jsonText = decompressed.toString('utf-8');
    } else {
      // Sin compresión
      console.log('[Proxy] Sin compresión, leyendo directamente...');
      jsonText = buffer.toString('utf-8');
    }

    // Parsear JSON
    const jsonData = JSON.parse(jsonText);
    console.log('[Proxy] ✅ JSON válido - Registros:', Array.isArray(jsonData) ? jsonData.length : 'objeto');
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(jsonData);
    
  } catch (error) {
    console.error('[Proxy] ❌ Error:', error.message);
    return res.status(502).json({ 
      error: 'fetch failed', 
      message: error.message,
      hint: 'Verifica que el endpoint del SMN esté disponible'
    });
  }
}

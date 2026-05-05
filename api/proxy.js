// api/proxy.js - Node.js 24.x
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gunzip = promisify(zlib.gunzip);
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
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
      signal: AbortSignal.timeout(20000)
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
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(jsonData);
    
  } catch (error) {
    console.error('[Proxy] Error:', error.message);
    return res.status(502).json({ error: 'fetch failed', message: error.message });
  }
}

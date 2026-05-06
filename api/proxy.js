// api/proxy.js
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gunzip = promisify(zlib.gunzip);
const SMN_WHITELIST = 'https://smn.conagua.gob.mx';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=600');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const { searchParams } = new URL(req.url, `https://${req.headers.host}`);
  const targetUrl = searchParams.get('url');
  
  if (!targetUrl?.startsWith(SMN_WHITELIST)) {
    return res.status(403).json({ error: 'Dominio no permitido' });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0', 
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate'
      },
      signal: AbortSignal.timeout(25000)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let jsonText;
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      jsonText = (await gunzip(buffer)).toString('utf-8');
    } else {
      jsonText = buffer.toString('utf-8');
    }

    const jsonData = JSON.parse(jsonText);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(jsonData);
    
  } catch (error) {
    console.error(`[Proxy] ${error.message}`);
    return res.status(502).json({ 
      error: 'fetch failed', 
      message: error.message,
      method: new URL(targetUrl).searchParams.get('method')
    });
  }
}

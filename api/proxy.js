// api/proxy.js
// NO uses runtime: 'edge' - usaremos Node.js por defecto

const SMN_WHITELIST = 'https://smn.conagua.gob.mx';

export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=900');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = req.query.url;
  
  if (!targetUrl?.startsWith(SMN_WHITELIST)) {
    return res.status(403).json({ error: 'Dominio no permitido' });
  }

  try {
    // Fetch con headers que evitan gzip
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json, text/plain',
        // Importante: NO enviar Accept-Encoding para que el servidor no comprima
      }
    });

    const text = await response.text();
    
    // Validar que sea JSON
    try {
      JSON.parse(text);
    } catch (e) {
      console.error('JSON inválido:', text.substring(0, 100));
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(response.status).send(text);
    
  } catch (error) {
    console.error('Error en proxy:', error);
    return res.status(500).json({ error: error.message });
  }
}

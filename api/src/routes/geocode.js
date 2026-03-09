const express = require('express');
const axios = require('axios');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// In-memory cache for geocode results (reset on restart)
const geocodeCache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting: 1 request per second to Nominatim
let lastRequest = 0;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// GET /api/geocode?lat=X&lng=Y
router.get('/', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Parâmetros lat e lng são obrigatórios' });
    }

    // Round to 4 decimal places for cache key (~11m precision)
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

    // Check cache
    if (geocodeCache[key] && (Date.now() - geocodeCache[key].ts < CACHE_TTL)) {
      return res.json(geocodeCache[key].data);
    }

    // Rate limit: wait if needed
    const now = Date.now();
    const elapsed = now - lastRequest;
    if (elapsed < 1100) {
      await delay(1100 - elapsed);
    }
    lastRequest = Date.now();

    // Fetch from Nominatim
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=pt-BR`;
    const resp = await axios.get(url, {
      headers: {
        'User-Agent': 'HSQRastreamento/1.0 (admin@hsqrastreamento.com)',
      },
      timeout: 5000,
    });

    const data = resp.data;

    // Format address
    let address = 'Endereço não disponível';
    if (data && data.address) {
      const a = data.address;
      const parts = [];
      if (a.road) {
        let street = a.road;
        if (a.house_number) street += ', ' + a.house_number;
        parts.push(street);
      }
      if (a.suburb || a.neighbourhood) parts.push(a.suburb || a.neighbourhood);
      if (a.city || a.town || a.village || a.municipality) {
        let city = a.city || a.town || a.village || a.municipality;
        if (a.state) city += ' - ' + a.state;
        parts.push(city);
      }
      if (parts.length > 0) {
        address = parts.join(', ');
      } else if (data.display_name) {
        address = data.display_name;
      }
    } else if (data && data.display_name) {
      address = data.display_name;
    }

    const result = { address, raw: data };

    // Cache it
    geocodeCache[key] = { data: result, ts: Date.now() };

    res.json(result);
  } catch (err) {
    console.error('Geocode error:', err.message);
    res.json({ address: 'Endereço não disponível', error: err.message });
  }
});

// Batch geocode: POST /api/geocode/batch
// Body: { positions: [{lat, lng}, ...] }
router.post('/batch', async (req, res) => {
  try {
    const { positions } = req.body;
    if (!Array.isArray(positions) || positions.length === 0) {
      return res.status(400).json({ error: 'Array positions é obrigatório' });
    }

    // Limit batch size
    const batch = positions.slice(0, 20);
    const results = [];

    for (const pos of batch) {
      const lat = parseFloat(pos.lat);
      const lng = parseFloat(pos.lng);
      if (isNaN(lat) || isNaN(lng)) {
        results.push({ lat: pos.lat, lng: pos.lng, address: 'Coordenadas inválidas' });
        continue;
      }

      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

      // Check cache first
      if (geocodeCache[key] && (Date.now() - geocodeCache[key].ts < CACHE_TTL)) {
        results.push({ lat, lng, address: geocodeCache[key].data.address });
        continue;
      }

      // Rate limit
      const now = Date.now();
      const elapsed = now - lastRequest;
      if (elapsed < 1100) {
        await delay(1100 - elapsed);
      }
      lastRequest = Date.now();

      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=pt-BR`;
        const resp = await axios.get(url, {
          headers: { 'User-Agent': 'HSQRastreamento/1.0 (admin@hsqrastreamento.com)' },
          timeout: 5000,
        });

        const data = resp.data;
        let address = 'Endereço não disponível';
        if (data && data.address) {
          const a = data.address;
          const parts = [];
          if (a.road) {
            let street = a.road;
            if (a.house_number) street += ', ' + a.house_number;
            parts.push(street);
          }
          if (a.suburb || a.neighbourhood) parts.push(a.suburb || a.neighbourhood);
          if (a.city || a.town || a.village || a.municipality) {
            let city = a.city || a.town || a.village || a.municipality;
            if (a.state) city += ' - ' + a.state;
            parts.push(city);
          }
          if (parts.length > 0) address = parts.join(', ');
          else if (data.display_name) address = data.display_name;
        } else if (data && data.display_name) {
          address = data.display_name;
        }

        geocodeCache[key] = { data: { address, raw: data }, ts: Date.now() };
        results.push({ lat, lng, address });
      } catch (e) {
        results.push({ lat, lng, address: 'Endereço não disponível' });
      }
    }

    res.json(results);
  } catch (err) {
    console.error('Batch geocode error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar endereços' });
  }
});

module.exports = router;

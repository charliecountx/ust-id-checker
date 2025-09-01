// api/check-vat.js
export default async function handler(req, res) {
  // CORS Headers setzen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // OPTIONS request für CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Nur GET und POST erlauben
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Parameter aus Query (GET) oder Body (POST) holen
  const vatId = req.method === 'GET' 
    ? req.query.vatId 
    : req.body?.vatId;
  
  if (!vatId) {
    return res.status(400).json({ 
      error: 'USt-ID ist erforderlich',
      usage: 'GET /api/check-vat?vatId=DE123456789'
    });
  }
  
  const cleanVatId = vatId.toString().replace(/\s/g, '').toUpperCase();
  
  // Format-Validierung
  const vatFormats = {
    'AT': /^ATU\d{8}$/,
    'BE': /^BE(0\d{9}|\d{10})$/,
    'BG': /^BG\d{9,10}$/,
    'CY': /^CY\d{8}[A-Z]$/,
    'CZ': /^CZ\d{8,10}$/,
    'DE': /^DE\d{9}$/,
    'DK': /^DK\d{8}$/,
    'EE': /^EE\d{9}$/,
    'GR': /^EL\d{9}$/,
    'ES': /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
    'FI': /^FI\d{8}$/,
    'FR': /^FR[A-HJ-NP-Z0-9]{2}\d{9}$/,
    'HR': /^HR\d{11}$/,
    'HU': /^HU\d{8}$/,
    'IE': /^IE(\d{7}[A-W]|\d[A-Z*+]\d{5}[A-W])$/,
    'IT': /^IT\d{11}$/,
    'LT': /^LT(\d{9}|\d{12})$/,
    'LU': /^LU\d{8}$/,
    'LV': /^LV\d{11}$/,
    'MT': /^MT\d{8}$/,
    'NL': /^NL\d{9}B\d{2}$/,
    'PL': /^PL\d{10}$/,
    'PT': /^PT\d{9}$/,
    'RO': /^RO\d{2,10}$/,
    'SE': /^SE\d{12}$/,
    'SI': /^SI\d{8}$/,
    'SK': /^SK\d{10}$/
  };
  
  const countryCode = cleanVatId.substring(0, 2);
  const vatNumber = cleanVatId.substring(2);
  
  // Format prüfen
  if (!vatFormats[countryCode]) {
    return res.status(400).json({
      vatId: cleanVatId,
      valid: false,
      error: 'Unbekanntes Land oder ungültiges Format',
      formatValid: false
    });
  }
  
  if (!vatFormats[countryCode].test(cleanVatId)) {
    return res.status(400).json({
      vatId: cleanVatId,
      valid: false,
      error: `Format entspricht nicht den Regeln für ${countryCode}`,
      formatValid: false
    });
  }
  
  // EU VIES API aufrufen (Server-zu-Server, kein CORS!)
  try {
    console.log(`Prüfe USt-ID: ${cleanVatId}`);
    
    const viesUrl = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNumber}`;
    
    const response = await fetch(viesUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'USt-ID-Prüfer/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`VIES API Fehler: ${response.status}`);
      throw new Error(`VIES API returned ${response.status}`);
    }
    
    const viesData = await response.json();
    console.log('VIES Response:', viesData);
    
    // Erfolgreiche Antwort
    return res.status(200).json({
      vatId: cleanVatId,
      valid: viesData.valid,
      name: viesData.name || '',
      address: viesData.address || '',
      countryCode: countryCode,
      requestDate: viesData.requestDate || new Date().toISOString(),
      formatValid: true,
      source: 'EU VIES',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('VIES API Fehler:', error);
    
    // Bei API-Fehler: Format ist gültig, aber Prüfung fehlgeschlagen
    return res.status(200).json({
      vatId: cleanVatId,
      valid: null,
      error: 'VIES API nicht erreichbar',
      formatValid: true,
      countryCode: countryCode,
      timestamp: new Date().toISOString(),
      message: 'Format ist gültig, aber Online-Prüfung fehlgeschlagen'
    });
  }
}

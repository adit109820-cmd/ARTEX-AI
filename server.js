const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let cachedIPs = null;
let lastCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 Minutes Cache

// Robust DoH Resolver (Cloudflare domain -> Google domain -> Azure Anycast Fallback)
async function resolveViaDoH(hostname) {
  const now = Date.now();
  if (cachedIPs && (now - lastCacheTime < CACHE_TTL)) {
    return cachedIPs;
  }

  // 1. Cloudflare DoH using proper domain (prevents IP SSL cert rejection)
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.Answer && data.Answer.length > 0) {
        const aRecords = data.Answer.filter(a => a.type === 1 && a.data).map(a => a.data.trim());
        if (aRecords.length > 0) {
          cachedIPs = aRecords;
          lastCacheTime = now;
          return cachedIPs;
        }
      }
    }
  } catch (e) {}

  // 2. Google DoH using proper domain
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`);
    if (res.ok) {
      const data = await res.json();
      if (data.Answer && data.Answer.length > 0) {
        const aRecords = data.Answer.filter(a => a.type === 1 && a.data).map(a => a.data.trim());
        if (aRecords.length > 0) {
          cachedIPs = aRecords;
          lastCacheTime = now;
          return cachedIPs;
        }
      }
    }
  } catch (e) {}

  // 3. Fallback Azure Front Door Anycast IPs (Ensures resolution never fails)
  cachedIPs = ['13.107.246.70', '13.107.213.70'];
  lastCacheTime = now;
  return cachedIPs;
}

// Node.js compliant custom DNS lookup
function customDNSLookup(hostname, options, callback) {
  let cb = callback;
  let opts = options;
  if (typeof options === 'function') {
    cb = options;
    opts = {};
  }

  resolveViaDoH(hostname)
    .then((ips) => {
      if (opts && opts.all) {
        cb(null, ips.map(ip => ({ address: ip, family: 4 })));
      } else {
        cb(null, ips[0], 4);
      }
    })
    .catch(() => {
      // Hard fallback
      if (opts && opts.all) {
        cb(null, [{ address: '13.107.246.70', family: 4 }]);
      } else {
        cb(null, '13.107.246.70', 4);
      }
    });
}

function requestAzureAI(githubToken, modelName, messages) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: modelName,
      messages: messages,
      max_tokens: 1000
    });

    const targetHost = 'models.inference.ai.azure.com';

    const options = {
      hostname: targetHost,
      port: 443,
      path: '/chat/completions',
      method: 'POST',
      servername: targetHost, // Passes TLS SNI for Azure Front Door
      lookup: customDNSLookup,
      headers: {
        'Host': targetHost,
        'Authorization': `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'Artex-AI-Backend'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          reject(new Error(`Azure response parse error (Status ${res.statusCode})`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  const githubToken = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : null;

  if (!githubToken) {
    return res.status(500).json({ error: "Render Environment variables me GITHUB_TOKEN missing hai." });
  }

  const models = [
    "meta-llama-3.3-70b-instruct",
    "gpt-4o-mini",
    "Phi-3.5-mini-instruct"
  ];

  let lastError = "";

  for (const modelName of models) {
    try {
      const result = await requestAzureAI(githubToken, modelName, messages);
      
      if (result.statusCode === 200 && result.body?.choices?.[0]?.message?.content) {
        return res.json({ reply: result.body.choices[0].message.content });
      } else {
        lastError = result.body?.error?.message || `Status ${result.statusCode}: ${JSON.stringify(result.body)}`;
      }
    } catch (err) {
      lastError = `${modelName}: ${err.message}`;
    }
  }

  return res.status(500).json({ error: `GitHub AI Error: ${lastError}` });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

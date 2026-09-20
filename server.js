const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Cloudflare DoH (1.1.1.1) with TLS Identity Bypass
function resolveCloudflare(domain) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '1.1.1.1',
      port: 443,
      path: `/dns-query?name=${encodeURIComponent(domain)}&type=A`,
      method: 'GET',
      headers: {
        'Accept': 'application/dns-json',
        'Host': 'cloudflare-dns.com'
      },
      checkServerIdentity: () => undefined // Direct IP TLS verification check bypass
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.Answer && json.Answer.length > 0) {
            const aRecord = json.Answer.find(ans => ans.type === 1);
            if (aRecord && aRecord.data) return resolve(aRecord.data);
          }
          reject(new Error("Cloudflare DoH answer empty"));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Google DoH (8.8.8.8) with TLS Identity Bypass
function resolveGoogle(domain) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '8.8.8.8',
      port: 443,
      path: `/resolve?name=${encodeURIComponent(domain)}&type=A`,
      method: 'GET',
      headers: {
        'Host': 'dns.google'
      },
      checkServerIdentity: () => undefined // Direct IP TLS verification check bypass
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.Answer && json.Answer.length > 0) {
            const aRecord = json.Answer.find(ans => ans.type === 1);
            if (aRecord && aRecord.data) return resolve(aRecord.data);
          }
          reject(new Error("Google DoH answer empty"));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// In-memory DNS Cache
let cachedIP = null;
let lastCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getAzureIP() {
  const now = Date.now();
  if (cachedIP && (now - lastCacheTime < CACHE_TTL)) {
    return cachedIP;
  }

  const targetDomain = 'models.inference.ai.azure.com';

  // 1. Try Cloudflare DoH
  try {
    const ip = await resolveCloudflare(targetDomain);
    cachedIP = ip;
    lastCacheTime = now;
    return ip;
  } catch (e) {}

  // 2. Try Google DoH
  try {
    const ip = await resolveGoogle(targetDomain);
    cachedIP = ip;
    lastCacheTime = now;
    return ip;
  } catch (e) {}

  // 3. Emergency Static Azure Front Door Fallback IPs
  const fallbackIPs = ["13.107.246.70", "13.107.213.70", "20.119.8.38"];
  return fallbackIPs[Math.floor(Math.random() * fallbackIPs.length)];
}

function requestAzureAI(ipAddress, githubToken, modelName, messages) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: modelName,
      messages: messages,
      max_tokens: 1000
    });

    const targetHost = 'models.inference.ai.azure.com';

    const options = {
      hostname: ipAddress,
      port: 443,
      path: '/chat/completions',
      method: 'POST',
      servername: targetHost, // Azure Front Door SNI Header
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
          reject(new Error(`Invalid JSON response: ${responseData}`));
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

  const azureIP = await getAzureIP();

  const models = [
    "meta-llama-3.3-70b-instruct",
    "gpt-4o-mini",
    "Phi-3.5-mini-instruct"
  ];

  let lastError = "";

  for (const modelName of models) {
    try {
      const result = await requestAzureAI(azureIP, githubToken, modelName, messages);
      
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

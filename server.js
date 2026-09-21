const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const tls = require('tls');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let cachedIP = null;
let lastCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 Minutes Cache

// HTTPS DoH (Port 443 - Never blocked on Render)
async function resolveAzureIP() {
  const now = Date.now();
  if (cachedIP && (now - lastCacheTime < CACHE_TTL)) {
    return cachedIP;
  }

  const domain = 'models.inference.ai.azure.com';

  // Method 1: Cloudflare DoH via HTTPS (Port 443)
  try {
    const res = await fetch(`https://1.1.1.1/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    const json = await res.json();
    if (json.Answer && json.Answer.length > 0) {
      const record = json.Answer.find(a => a.type === 1);
      if (record && record.data) {
        cachedIP = record.data.trim();
        lastCacheTime = now;
        return cachedIP;
      }
    }
  } catch (e) {}

  // Method 2: Google DoH via HTTPS (Port 443)
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
    const json = await res.json();
    if (json.Answer && json.Answer.length > 0) {
      const record = json.Answer.find(a => a.type === 1);
      if (record && record.data) {
        cachedIP = record.data.trim();
        lastCacheTime = now;
        return cachedIP;
      }
    }
  } catch (e) {}

  // Method 3: Azure Front Door Anycast Fallback IP
  return '13.107.246.70';
}

function requestAzureAI(azureIP, githubToken, modelName, messages) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: modelName,
      messages: messages,
      max_tokens: 1000
    });

    const targetHost = 'models.inference.ai.azure.com';

    const options = {
      hostname: azureIP, // Direct IP connection (bypasses Render OS DNS completely)
      port: 443,
      path: '/chat/completions',
      method: 'POST',
      servername: targetHost, // SNI header for Azure Front Door
      checkServerIdentity: (host, cert) => {
        // Validates cert against domain targetHost, NOT raw IP address
        return tls.checkServerIdentity(targetHost, cert);
      },
      headers: {
        'Host': targetHost, // HTTP Host header for Azure routing
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
          reject(new Error(`Azure non-JSON response (Status ${res.statusCode})`));
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

  const azureIP = await resolveAzureIP();

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

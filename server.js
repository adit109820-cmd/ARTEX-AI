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

// DoH Cloudflare (1.1.1.1)
function queryDoHCloudflare(domain) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: '1.1.1.1',
      port: 443,
      path: `/dns-query?name=${encodeURIComponent(domain)}&type=A`,
      method: 'GET',
      servername: 'one.one.one.one',
      checkServerIdentity: (host, cert) => tls.checkServerIdentity('one.one.one.one', cert),
      headers: {
        'Accept': 'application/dns-json',
        'Host': 'one.one.one.one'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.Answer && json.Answer.length > 0) {
            const aRecord = json.Answer.find(a => a.type === 1);
            if (aRecord && aRecord.data) return resolve(aRecord.data);
          }
          reject(new Error('No A record in Cloudflare DoH'));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// DoH Google (8.8.8.8)
function queryDoHGoogle(domain) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: '8.8.8.8',
      port: 443,
      path: `/resolve?name=${encodeURIComponent(domain)}&type=A`,
      method: 'GET',
      servername: 'dns.google',
      checkServerIdentity: (host, cert) => tls.checkServerIdentity('dns.google', cert),
      headers: {
        'Host': 'dns.google'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.Answer && json.Answer.length > 0) {
            const aRecord = json.Answer.find(a => a.type === 1);
            if (aRecord && aRecord.data) return resolve(aRecord.data);
          }
          reject(new Error('No A record in Google DoH'));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

let cachedIP = null;
let lastCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 Minutes

async function getResolvedIP(domain) {
  const now = Date.now();
  if (cachedIP && (now - lastCacheTime < CACHE_TTL)) {
    return cachedIP;
  }

  try {
    const ip = await queryDoHCloudflare(domain);
    if (ip && typeof ip === 'string') {
      cachedIP = ip.trim();
      lastCacheTime = now;
      return cachedIP;
    }
  } catch (e) {}

  try {
    const ip = await queryDoHGoogle(domain);
    if (ip && typeof ip === 'string') {
      cachedIP = ip.trim();
      lastCacheTime = now;
      return cachedIP;
    }
  } catch (e) {}

  // Azure Front Door Anycast Fallback IP
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
      hostname: azureIP, // Direct IP address (DNS lookup bypassed)
      port: 443,
      path: '/chat/completions',
      method: 'POST',
      servername: targetHost, // SNI for TLS handshake
      checkServerIdentity: (host, cert) => {
        // Validates Azure certificate against target host domain
        return tls.checkServerIdentity(targetHost, cert);
      },
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

  const azureIP = await getResolvedIP('models.inference.ai.azure.com');

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

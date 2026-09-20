const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Cloudflare DoH (DNS over HTTPS) with TLS SNI Header
function resolveCloudflare(domain) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '1.1.1.1',
      port: 443,
      path: `/dns-query?name=${encodeURIComponent(domain)}&type=A`,
      method: 'GET',
      servername: 'one.one.one.one',
      headers: {
        'Accept': 'application/dns-json',
        'Host': 'one.one.one.one'
      }
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
          reject(new Error(`Cloudflare DoH invalid response`));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Google DoH Fallback
function resolveGoogle(domain) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '8.8.8.8',
      port: 443,
      path: `/resolve?name=${encodeURIComponent(domain)}&type=A`,
      method: 'GET',
      servername: 'dns.google',
      headers: {
        'Host': 'dns.google'
      }
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
          reject(new Error(`Google DoH invalid response`));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// In-memory DNS cache (Repeated DoH calls avoid karne ke liye)
let cachedIP = null;
let lastCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 Minutes

async function getAzureIP() {
  const now = Date.now();
  if (cachedIP && (now - lastCacheTime < CACHE_TTL)) {
    return cachedIP;
  }

  const targetDomain = 'models.inference.ai.azure.com';

  try {
    const ip = await resolveCloudflare(targetDomain);
    cachedIP = ip;
    lastCacheTime = now;
    return ip;
  } catch (err1) {
    console.warn("Cloudflare DoH fallback triggered");
  }

  try {
    const ip = await resolveGoogle(targetDomain);
    cachedIP = ip;
    lastCacheTime = now;
    return ip;
  } catch (err2) {
    console.warn("Google DoH fallback triggered");
  }

  throw new Error("DNS resolution failed on both Cloudflare and Google DoH");
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
      hostname: ipAddress, // Direct resolved IP (e.g. 20.119.8.38)
      port: 443,
      path: '/chat/completions',
      method: 'POST',
      servername: targetHost, // SNI Header for Azure TLS Handshake
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

  let azureIP = null;
  try {
    azureIP = await getAzureIP();
  } catch (dnsErr) {
    return res.status(500).json({ error: `DNS Resolution Error: ${dnsErr.message}` });
  }

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
           

const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const dns = require('dns');

// Public DNS servers set karein taaki Render ka internal DNS bypass ho sake
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  console.log('Custom DNS set error:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let cachedIP = null;
let lastCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 Minutes Cache

// Dynamic IP Resolver (c-ares -> Cloudflare DoH -> Google DoH)
async function resolveDomainIP(domain) {
  const now = Date.now();
  if (cachedIP && (now - lastCacheTime < CACHE_TTL)) {
    return cachedIP;
  }

  // 1. Try c-ares lookup via Google/Cloudflare DNS
  try {
    const addresses = await new Promise((resolve, reject) => {
      dns.resolve4(domain, (err, addrs) => err ? reject(err) : resolve(addrs));
    });
    if (addresses && addresses.length > 0) {
      cachedIP = addresses[0];
      lastCacheTime = now;
      return cachedIP;
    }
  } catch (e) {}

  // 2. Try Cloudflare DNS-over-HTTPS (Port 443)
  try {
    const ip = await new Promise((resolve, reject) => {
      const req = https.get(`https://1.1.1.1/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
        headers: { 'Accept': 'application/dns-json' },
        timeout: 4000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const record = json.Answer && json.Answer.find(a => a.type === 1);
            if (record && record.data) resolve(record.data.trim());
            else reject(new Error('No A record in Cloudflare DoH'));
          } catch (err) { reject(err); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Cloudflare DoH timeout')); });
    });
    if (ip) {
      cachedIP = ip;
      lastCacheTime = now;
      return cachedIP;
    }
  } catch (e) {}

  // 3. Try Google DNS-over-HTTPS (Port 443)
  try {
    const ip = await new Promise((resolve, reject) => {
      const req = https.get(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`, {
        timeout: 4000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const record = json.Answer && json.Answer.find(a => a.type === 1);
            if (record && record.data) resolve(record.data.trim());
            else reject(new Error('No A record in Google DoH'));
          } catch (err) { reject(err); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Google DoH timeout')); });
    });
    if (ip) {
      cachedIP = ip;
      lastCacheTime = now;
      return cachedIP;
    }
  } catch (e) {}

  throw new Error(`Failed to resolve IP for ${domain}`);
}

// Node.js compliant custom DNS lookup
function customDNSLookup(hostname, options, callback) {
  let cb = callback;
  let opts = options;
  if (typeof options === 'function') {
    cb = options;
    opts = {};
  }

  resolveDomainIP(hostname)
    .then((ip) => {
      if (opts && opts.all) {
        cb(null, [{ address: ip, family: 4 }]);
      } else {
        cb(null, ip, 4);
      }
    })
    .catch((err) => {
      cb(err);
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
      lookup: customDNSLookup, // System getaddrinfo ko bypass karke direct resolution karta hai
      headers: {
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
          reject(new Error(`Azure response parse error: ${responseData}`));
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

const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const dns = require('dns');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let cachedIP = null;
let lastCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 Minutes Cache

// DoH / c-ares IP resolver
function resolveIPViaDoH() {
  return new Promise((resolve) => {
    const now = Date.now();
    if (cachedIP && (now - lastCacheTime < CACHE_TTL)) {
      return resolve(cachedIP);
    }

    // 1. Native c-ares lookup
    dns.resolve4('models.inference.ai.azure.com', (err, addresses) => {
      if (!err && addresses && addresses.length > 0) {
        cachedIP = addresses[0];
        lastCacheTime = now;
        return resolve(cachedIP);
      }

      // 2. Cloudflare DoH fallback
      const req = https.request('https://1.1.1.1/dns-query?name=models.inference.ai.azure.com&type=A', {
        headers: { 'Accept': 'application/dns-json' },
        checkServerIdentity: () => undefined
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.Answer && json.Answer.length > 0) {
              const rec = json.Answer.find(a => a.type === 1);
              if (rec && rec.data) {
                cachedIP = rec.data;
                lastCacheTime = now;
                return resolve(cachedIP);
              }
            }
          } catch (e) {}
          resolve('13.107.246.70');
        });
      });
      req.on('error', () => resolve('13.107.246.70'));
      req.end();
    });
  });
}

// Node.js compliant custom DNS lookup
function customDNSLookup(hostname, options, callback) {
  let cb = callback;
  let opts = options;
  if (typeof options === 'function') {
    cb = options;
    opts = {};
  }

  resolveIPViaDoH()
    .then((ip) => {
      const validIP = (ip && typeof ip === 'string' && ip.trim()) ? ip.trim() : '13.107.246.70';
      if (opts && opts.all) {
        cb(null, [{ address: validIP, family: 4 }]);
      } else {
        cb(null, validIP, 4);
      }
    })
    .catch(() => {
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
      servername: targetHost,
      lookup: customDNSLookup,
      checkServerIdentity: () => undefined, // Azure ke *.azureedge.net cert mismatch error ko bypass karta hai
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

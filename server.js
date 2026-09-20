const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Render OS DNS ko bypass karne ke liye DNS-over-HTTPS (DoH) engine
async function getAzureIP() {
  const targetDomain = 'models.inference.ai.azure.com';

  // 1. Try Cloudflare DoH (Direct IP call - No OS DNS needed)
  try {
    const res = await fetch(`https://1.1.1.1/dns-query?name=${targetDomain}&type=A`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    const data = await res.json();
    if (data.Answer && data.Answer.length > 0) {
      const aRecord = data.Answer.find(item => item.type === 1);
      if (aRecord && aRecord.data) return aRecord.data;
    }
  } catch (e) {
    console.warn("Cloudflare DoH failed, trying Google DoH...");
  }

  // 2. Fallback to Google DoH
  try {
    const res = await fetch(`https://8.8.8.8/resolve?name=${targetDomain}&type=A`);
    const data = await res.json();
    if (data.Answer && data.Answer.length > 0) {
      const aRecord = data.Answer.find(item => item.type === 1);
      if (aRecord && aRecord.data) return aRecord.data;
    }
  } catch (e) {
    console.error("Google DoH failed");
  }

  return null;
}

// Direct IP + TLS SNI HTTPS Request
function requestAzureAI(ipAddress, githubToken, modelName, messages) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: modelName,
      messages: messages,
      max_tokens: 1000
    });

    const isIP = Boolean(ipAddress);
    const targetHost = 'models.inference.ai.azure.com';

    const options = {
      hostname: isIP ? ipAddress : targetHost,
      port: 443,
      path: '/chat/completions',
      method: 'POST',
      servername: targetHost, // TLS Handshake ke liye mandatory
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

  // Fetch IP over HTTPS (No system DNS call)
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

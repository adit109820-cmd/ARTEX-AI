const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Direct root directory se static files serve karein
app.use(express.static(__dirname));

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  const groqKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;
  const geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  const openrouterKey = process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.trim() : null;

  let lastError = "";

  // 1. OPTION 1: GROQ API (Sabse Fast & Reliable)
  if (groqKey) {
    const groqModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
    for (const model of groqModels) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ model, messages, max_tokens: 1000 })
        });
        const data = await response.json();
        if (response.ok && data.choices && data.choices[0]?.message?.content) {
          return res.json({ reply: data.choices[0].message.content });
        } else {
          lastError = data.error?.message || "Groq model failed";
        }
      } catch (e) {
        lastError = e.message;
      }
    }
  }

  // 2. OPTION 2: GEMINI API (Native Google Studio)
  if (geminiKey) {
    let systemText = "";
    const contents = [];

    if (Array.isArray(messages)) {
      for (const msg of messages) {
        if (msg.role === 'system') {
          systemText += (systemText ? "\n" : "") + msg.content;
        } else {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(msg.content) }]
          });
        }
      }
    }

    const payload = {
      contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello' }] }]
    };
    if (systemText) payload.systemInstruction = { parts: [{ text: systemText }] };

    const geminiModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    for (const model of geminiModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok && data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
          return res.json({ reply: data.candidates[0].content.parts[0].text });
        } else {
          lastError = data.error?.message || "Gemini model failed";
        }
      } catch (e) {
        lastError = e.message;
      }
    }
  }

  // 3. OPTION 3: OPENROUTER API (Fallback)
  if (openrouterKey) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemma-2-9b-it:free",
          messages,
          max_tokens: 1000
        })
      });
      const data = await response.json();
      if (response.ok && data.choices && data.choices[0]?.message?.content) {
        return res.json({ reply: data.choices[0].message.content });
      } else {
        lastError = data.error?.message || "OpenRouter failed";
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  // Key missing or all failed
  if (!groqKey && !geminiKey && !openrouterKey) {
    return res.status(500).json({ error: "Server par koi API Key set nahi hai. Render Dashboard me GROQ_API_KEY ya GEMINI_API_KEY add karein." });
  }

  return res.status(500).json({ error: `API Error: ${lastError}` });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Static files serve karne ke liye
app.use(express.static(__dirname));

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  const cerebrasKey = process.env.CEREBRAS_API_KEY ? process.env.CEREBRAS_API_KEY.trim() : null;
  const groqKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;
  const geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

  let details = [];

  // 1. CEREBRAS API (Exact official model names)
  if (cerebrasKey) {
    const cerebrasModels = ["llama3.3-70b", "llama3.1-8b", "llama-3.3-70b"];
    for (const model of cerebrasModels) {
      try {
        const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cerebrasKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: 1000
          })
        });

        const data = await response.json();
        if (response.ok && data.choices && data.choices[0]?.message?.content) {
          return res.json({ reply: data.choices[0].message.content });
        } else {
          details.push(`Cerebras (${model}): ${data.error?.message || JSON.stringify(data)}`);
        }
      } catch (e) {
        details.push(`Cerebras (${model}): ${e.message}`);
      }
    }
  }

  // 2. GROQ API (Backup)
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
          body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: 1000
          })
        });

        const data = await response.json();
        if (response.ok && data.choices && data.choices[0]?.message?.content) {
          return res.json({ reply: data.choices[0].message.content });
        } else {
          details.push(`Groq (${model}): ${data.error?.message || JSON.stringify(data)}`);
        }
      } catch (e) {
        details.push(`Groq (${model}): ${e.message}`);
      }
    }
  }

  // 3. GEMINI API (Backup)
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

    const geminiModels = ["gemini-2.0-flash", "gemini-1.5-flash"];
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
          details.push(`Gemini (${model}): ${data.error?.message || JSON.stringify(data)}`);
        }
      } catch (e) {
        details.push(`Gemini (${model}): ${e.message}`);
      }
    }
  }

  if (!cerebrasKey && !groqKey && !geminiKey) {
    return res.status(500).json({ error: "Server par koi API Key set nahi hai. Render Environment Variable me CEREBRAS_API_KEY set karein." });
  }

  return res.status(500).json({ error: `API Details: ${details.join(" | ")}` });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

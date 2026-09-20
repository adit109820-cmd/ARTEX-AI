const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Root level static files serve karne ke liye
app.use(express.static(__dirname));

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

  if (!apiKey) {
    return res.status(500).json({ error: "Server par GEMINI_API_KEY set nahi hai. Render Dashboard check karein." });
  }

  // System instruction aur conversation history prepare karein
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

  if (systemText) {
    payload.systemInstruction = {
      parts: [{ text: systemText }]
    };
  }

  // Active Working Gemini Models
  const models = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash"
  ];

  let aiResponseText = null;
  let lastErr = "";

  for (const modelName of models) {
    try {
      console.log(`Trying model: ${modelName}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        aiResponseText = data.candidates[0].content.parts[0].text;
        console.log(`Success with: ${modelName}`);
        break;
      } else {
        lastErr = data.error?.message || "Model response fail ho gaya";
        console.warn(`Model ${modelName} failed:`, lastErr);
      }
    } catch (err) {
      lastErr = err.message;
      console.error(`Error with ${modelName}:`, err.message);
    }
  }

  if (aiResponseText) {
    res.json({ reply: aiResponseText });
  } else {
    res.status(500).json({ error: `Gemini API Error: ${lastErr}` });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

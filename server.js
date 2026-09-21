const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Sleep function for smooth retry backoff
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: "Render Environment variables me GEMINI_API_KEY missing hai." });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages format." });
    }

    // Convert chat messages to proper native Gemini JSON format
    const contents = messages.map(m => ({
      role: (m.role === 'assistant' || m.role === 'ai' || m.role === 'model') ? 'model' : 'user',
      parts: [{ text: m.content || m.text || '' }]
    }));

    // High availability active models
    const models = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-flash-latest',
      'gemini-2.5-pro'
    ];

    let lastError = "Server busy";

    for (const modelName of models) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents })
        });

        const data = await response.json();

        if (response.ok && data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
          const reply = data.candidates[0].content.parts[0].text;
          return res.json({ reply });
        } else {
          lastError = data.error?.message || `Status ${response.status}`;
          // Pause briefly before trying the backup model
          await sleep(800);
        }
      } catch (err) {
        lastError = err.message;
        await sleep(800);
      }
    }

    return res.status(500).json({ error: `Gemini AI Error: ${lastError}` });

  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: `AI Error: ${error.message}` });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

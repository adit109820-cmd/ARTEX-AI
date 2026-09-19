const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Direct root directory se static files serve karne ke liye
app.use(express.static(__dirname));

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Server par OPENROUTER_API_KEY set nahi hai." });
  }

  const freeModels = [
    "google/gemma-2-9b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "qwen/qwen-2.5-7b-instruct:free",
    "deepseek/deepseek-r1:free"
  ];

  let aiResponseText = null;
  let lastErr = '';

  for (const modelName of freeModels) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: modelName,
          messages: messages,
          max_tokens: 1000
        })
      });

      const data = await response.json();

      if (response.ok && data.choices && data.choices[0]?.message?.content) {
        aiResponseText = data.choices[0].message.content;
        break;
      } else {
        lastErr = data.error?.message || "Model limit reached or endpoint unavailable";
      }
    } catch (err) {
      lastErr = err.message;
    }
  }

  if (aiResponseText) {
    res.json({ reply: aiResponseText });
  } else {
    res.status(500).json({ error: lastErr });
  }
});

// Direct root level se index.html serve karne ke liye
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

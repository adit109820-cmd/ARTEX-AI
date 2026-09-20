const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  const githubToken = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : null;

  if (!githubToken) {
    return res.status(500).json({ 
      error: "Render Environment Variables me GITHUB_TOKEN set nahi hai." 
    });
  }

  // GitHub Models official endpoints
  const models = [
    "meta-llama-3.3-70b-instruct",
    "gpt-4o-mini",
    "Phi-3.5-mini-instruct"
  ];

  let aiResponseText = null;
  let lastErr = "";

  for (const modelName of models) {
    try {
      const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${githubToken}`,
          "Content-Type": "application/json",
          "User-Agent": "Artex-AI"
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
        lastErr = data.error?.message || JSON.stringify(data);
      }
    } catch (err) {
      lastErr = `Network Issue (${modelName}): ${err.message}`;
    }
  }

  if (aiResponseText) {
    return res.json({ reply: aiResponseText });
  } else {
    return res.status(500).json({ error: `GitHub AI Error: ${lastErr}` });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

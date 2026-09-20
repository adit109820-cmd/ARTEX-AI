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
  const cerebrasKey = process.env.CEREBRAS_API_KEY ? process.env.CEREBRAS_API_KEY.trim() : null;

  if (!cerebrasKey) {
    return res.status(500).json({ error: "Render dashboard me CEREBRAS_API_KEY missing hai." });
  }

  try {
    // 1. Account se active models ki list dynamically fetch karein
    let targetModel = null;
    const modelsResponse = await fetch("https://api.cerebras.ai/v1/models", {
      headers: { "Authorization": `Bearer ${cerebrasKey}` }
    });

    if (modelsResponse.ok) {
      const modelsData = await modelsResponse.json();
      if (modelsData.data && modelsData.data.length > 0) {
        // Priority to 70b models, else pick the first available model
        const model70b = modelsData.data.find(m => m.id.includes("70b"));
        targetModel = model70b ? model70b.id : modelsData.data[0].id;
      }
    }

    // Fallback if dynamic fetch fails
    if (!targetModel) {
      targetModel = "llama-3.3-70b";
    }

    console.log(`Using Cerebras Model: ${targetModel}`);

    // 2. Chat completion request send karein
    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cerebrasKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: targetModel,
        messages: messages,
        max_tokens: 1000
      })
    });

    const data = await response.json();

    if (response.ok && data.choices && data.choices[0]?.message?.content) {
      return res.json({ reply: data.choices[0].message.content });
    } else {
      const errMsg = data.error?.message || JSON.stringify(data);
      return res.status(500).json({ error: `Cerebras Error (${targetModel}): ${errMsg}` });
    }

  } catch (err) {
    return res.status(500).json({ error: `Server Error: ${err.message}` });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

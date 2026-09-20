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
    let freeModels = [];

    // 1. Account se active models fetch karein
    const modelsResponse = await fetch("https://api.cerebras.ai/v1/models", {
      headers: { "Authorization": `Bearer ${cerebrasKey}` }
    });

    if (modelsResponse.ok) {
      const modelsData = await modelsResponse.json();
      if (modelsData.data && modelsData.data.length > 0) {
        // Sirf FREE Llama models filter karein (gpt-oss ya paid models ko exclude kar diya hai)
        freeModels = modelsData.data
          .map(m => m.id)
          .filter(id => id.toLowerCase().includes("llama") && !id.toLowerCase().includes("gpt-oss"));
      }
    }

    // Backup list agar dynamic fetch na ho
    if (freeModels.length === 0) {
      freeModels = ["llama-3.3-70b", "llama3.1-8b"];
    }

    let aiResponseText = null;
    let lastError = "";

    // 2. Free models ka loop — agar ek me error aaye toh next free model try karein
    for (const modelName of freeModels) {
      try {
        console.log(`Trying Cerebras free model: ${modelName}`);

        const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cerebrasKey}`,
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
          console.log(`Success with: ${modelName}`);
          break; // Working response milte hi loop stop
        } else {
          lastError = data.error?.message || JSON.stringify(data);
          console.warn(`Model ${modelName} failed, trying next...`);
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (aiResponseText) {
      return res.json({ reply: aiResponseText });
    } else {
      return res.status(500).json({ error: `Cerebras Free Tier Error: ${lastError}` });
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

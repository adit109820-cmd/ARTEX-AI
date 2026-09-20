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
    return res.status(500).json({ error: "Render Dashboard me CEREBRAS_API_KEY missing hai." });
  }

  try {
    // 1. Account se sare active models ki list dynamic mangwayen
    let availableModels = [];
    const modelsResponse = await fetch("https://api.cerebras.ai/v1/models", {
      headers: { "Authorization": `Bearer ${cerebrasKey}` }
    });

    if (modelsResponse.ok) {
      const modelsData = await modelsResponse.json();
      if (modelsData.data && Array.isArray(modelsData.data)) {
        availableModels = modelsData.data.map(m => m.id);
      }
    }

    // Direct Hardcoded Fallbacks (agar list API work na kare)
    if (availableModels.length === 0) {
      availableModels = ["llama-3.3-70b", "llama3.1-8b", "llama3.1-70b"];
    }

    let aiResponseText = null;
    let attemptedLog = [];

    // 2. Jo bhi models dikhein, un par automatic trial loop
    for (const modelId of availableModels) {
      // Known paid / special billing models ko skip karein
      if (modelId.toLowerCase().includes("gpt-oss")) continue;

      try {
        console.log(`Auto-trying model: ${modelId}`);

        const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cerebrasKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: modelId,
            messages: messages,
            max_tokens: 1000
          })
        });

        const data = await response.json();

        // Sahi response milte hi instant break
        if (response.ok && data.choices && data.choices[0]?.message?.content) {
          aiResponseText = data.choices[0].message.content;
          console.log(`Auto-selected working model: ${modelId}`);
          break;
        } else {
          const errReason = data.error?.message || "Failed";
          attemptedLog.push(`${modelId} (${errReason})`);
        }
      } catch (err) {
        attemptedLog.push(`${modelId} (${err.message})`);
      }
    }

    if (aiResponseText) {
      return res.json({ reply: aiResponseText });
    } else {
      return res.status(500).json({ 
        error: `Auto-selection complete lekin koi working model nahi mila. Tried: ${attemptedLog.join(" | ")}` 
      });
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

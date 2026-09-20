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

  if (!cerebrasKey) {
    return res.status(500).json({ error: "Server par CEREBRAS_API_KEY set nahi hai. Render Dashboard check karein." });
  }

  // Cerebras Official Active Models List
  const cerebrasModels = [
    "llama-3.3-70b",
    "llama3.1-8b",
    "llama3.1-70b",
    "deepseek-r1-distill-llama-70b"
  ];

  let aiResponseText = null;
  let lastError = "";

  for (const modelName of cerebrasModels) {
    try {
      console.log(`Trying Cerebras model: ${modelName}`);

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
        break;
      } else {
        lastError = data.error?.message || JSON.stringify(data);
        console.warn(`Model ${modelName} failed: ${lastError}`);
      }
    } catch (err) {
      lastError = err.message;
      console.error(`Error with ${modelName}: ${err.message}`);
    }
  }

  if (aiResponseText) {
    return res.json({ reply: aiResponseText });
  } else {
    return res.status(500).json({ error: `Cerebras Error: ${lastError}` });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

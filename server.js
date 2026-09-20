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
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Server par GEMINI_API_KEY set nahi hai. Render dashboard check karein." });
  }

  // Gemini ke reliable models ki list
  const geminiModels = [
    "gemini-1.5-flash",
    "gemini-2.5-flash",
    "gemini-1.5-pro"
  ];

  let aiResponseText = null;
  let lastErr = '';

  for (const modelName of geminiModels) {
    try {
      console.log(`Trying Gemini model: ${modelName}...`);

      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
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
        console.log(`Success with Gemini model: ${modelName}`);
        break;
      } else {
        lastErr = data.error?.message || "Gemini API error";
        console.warn(`Model ${modelName} failed: ${lastErr}`);
      }
    } catch (err) {
      lastErr = err.message;
      console.error(`Error with ${modelName}: ${err.message}`);
    }
  }

  if (aiResponseText) {
    res.json({ reply: aiResponseText });
  } else {
    res.status(500).json({ error: `Gemini Error: ${lastErr}` });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

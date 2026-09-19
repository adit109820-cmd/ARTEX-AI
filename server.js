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
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Server par GEMINI_API_KEY set nahi hai." });
  }

  try {
    // Google Gemini Official OpenAI-Compatible Endpoint
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gemini-1.5-flash",
        messages: messages,
        max_tokens: 1000
      })
    });

    const data = await response.json();

    if (response.ok && data.choices && data.choices[0]?.message?.content) {
      res.json({ reply: data.choices[0].message.content });
    } else {
      const errMsg = data.error?.message || "Gemini API Error";
      res.status(500).json({ error: errMsg });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Root static files serve karne ke liye
app.use(express.static(__dirname));

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  const cerebrasKey = process.env.CEREBRAS_API_KEY ? process.env.CEREBRAS_API_KEY.trim() : null;
  const sambanovaKey = process.env.SAMBANOVA_API_KEY ? process.env.SAMBANOVA_API_KEY.trim() : null;
  const groqKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;

  let lastError = "";

  // 1. CEREBRAS API (Sabse Fast & Recommended)
  if (cerebrasKey) {
    try {
      const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cerebrasKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b",
          messages: messages,
          max_tokens: 1000
        })
      });

      const data = await response.json();
      if (response.ok && data.choices && data.choices[0]?.message?.content) {
        return res.json({ reply: data.choices[0].message.content });
      } else {
        lastError = data.error?.message || "Cerebras API Error";
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  // 2. SAMBANOVA API (Second Backup)
  if (sambanovaKey) {
    try {
      const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sambanovaKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "Meta-Llama-3.1-8b-Instruct",
          messages: messages,
          max_tokens: 1000
        })
      });

      const data = await response.json();
      if (response.ok && data.choices && data.choices[0]?.message?.content) {
        return res.json({ reply: data.choices[0].message.content });
      } else {
        lastError = data.error?.message || "SambaNova API Error";
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  // 3. GROQ API (Agar active ho)
  if (groqKey) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: messages,
          max_tokens: 1000
        })
      });

      const data = await response.json();
      if (response.ok && data.choices && data.choices[0]?.message?.content) {
        return res.json({ reply: data.choices[0].message.content });
      } else {
        lastError = data.error?.message || "Groq API Error";
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  // Agar koi bhi Key set nahi hai
  if (!cerebrasKey && !sambanovaKey && !groqKey) {
    return res.status(500).json({ error: "Server par koi valid API Key set nahi hai. Render Dashboard check karein." });
  }

  return res.status(500).json({ error: `API Service Error: ${lastError}` });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

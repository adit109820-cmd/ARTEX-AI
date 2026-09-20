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
  const groqKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;
  const geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

  let aiResponseText = null;

  // 1. Try Cerebras API (If Key Exists)
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
        aiResponseText = data.choices[0].message.content;
      }
    } catch (e) {
      console.warn("Cerebras failed, falling back...");
    }
  }

  // 2. Try Groq API (If Key Exists)
  if (!aiResponseText && groqKey) {
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
        aiResponseText = data.choices[0].message.content;
      }
    } catch (e) {
      console.warn("Groq failed, falling back...");
    }
  }

  // 3. Keyless Public Engine (Bypasses Credit/Auth Restrictions)
  if (!aiResponseText) {
    try {
      // Extract latest user query
      const lastUserMsg = Array.isArray(messages) 
        ? messages.filter(m => m.role === 'user').pop()?.content 
        : 'Hello';

      const promptText = encodeURIComponent(String(lastUserMsg || 'Hello'));
      const url = `https://text.pollinations.ai/${promptText}?model=mistral`;

      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        if (text && !text.includes("doesn't have enough credits")) {
          aiResponseText = text;
        }
      }
    } catch (e) {
      console.warn("Keyless fallback failed");
    }
  }

  if (aiResponseText) {
    return res.json({ reply: aiResponseText });
  } else {
    return res.status(500).json({ error: "Artex AI response generate nahi kar pa raha hai. Kripya 5 seconds baad try karein." });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages format." });
    }

    // Format chat history properly
    const formattedMessages = messages.map(m => ({
      role: (m.role === 'ai' || m.role === 'model' || m.role === 'assistant') ? 'assistant' : 'user',
      content: m.content || m.text || ''
    }));

    // Free Public Keyless AI API (No signup / No key required)
    const response = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: formattedMessages,
        model: 'openai',
        seed: Math.floor(Math.random() * 1000000)
      })
    });

    if (response.ok) {
      const data = await response.json();
      const reply = data.choices && data.choices[0]?.message?.content;
      if (reply) {
        return res.json({ reply });
      }
    }

    // Backup simple endpoint if JSON endpoint is temporarily busy
    const lastUserMsg = formattedMessages[formattedMessages.length - 1]?.content || 'Hello';
    const textResponse = await fetch(`https://text.pollinations.ai/${encodeURIComponent(lastUserMsg)}`);
    
    if (textResponse.ok) {
      const replyText = await textResponse.text();
      return res.json({ reply: replyText });
    }

    return res.status(500).json({ error: "AI service currently busy. Please try sending your message again." });

  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: `AI Error: ${error.message}` });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

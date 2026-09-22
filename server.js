const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Strict rules to block unprompted personal/family details
const SYSTEM_PROMPT = `You are Artex AI, created by Aditya Yadav.

CRITICAL RULES:
1. BE DIRECT & CONCISE: Answer ONLY what the user asks. Do not give extra unwanted details.
2. CREATOR INFO: If asked about Aditya Yadav, mention ONLY that he is a talented software developer/AI enthusiast from India who created Artex AI. Keep it short.
3. ABSOLUTE BAN ON FAMILY/MENTORS: NEVER mention "Seema Ma'am", "Maya Devi", or "Surendra Kumar" under ANY circumstances unless the user explicitly types those exact names or asks specifically about "family", "parents", or "mentors".
4. GENERAL TASKS: For coding, writing, or general questions, answer accurately without adding personal context.`;

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages format." });
    }

    const formattedMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({
        role: (m.role === 'ai' || m.role === 'model' || m.role === 'assistant') ? 'assistant' : 'user',
        content: m.content || m.text || ''
      }))
    ];

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

    const lastUserMsg = messages[messages.length - 1]?.content || messages[messages.length - 1]?.text || 'Hello';
    const fallbackPrompt = `${SYSTEM_PROMPT}\n\nUser asked: "${lastUserMsg}". Answer concisely without mentioning family/mentors:`;

    const textResponse = await fetch(`https://text.pollinations.ai/${encodeURIComponent(fallbackPrompt)}`);
    
    if (textResponse.ok) {
      const replyText = await textResponse.text();
      return res.json({ reply: replyText });
    }

    return res.status(500).json({ error: "AI service currently busy. Please try again." });

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

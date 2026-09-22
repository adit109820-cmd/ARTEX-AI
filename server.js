const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Strict behavior rules for AI
const SYSTEM_PROMPT = `You are Artex AI, an intelligent AI assistant created by Aditya Yadav.

STRICT RESPONSE RULES:
1. BE DIRECT AND CONCISE: Answer ONLY what the user explicitly asks. Do NOT offer unprompted extra information or long intros.
2. WHO ARE YOU QUERY: If asked "Who are you" or "Who made you", reply simply in 1-2 short sentences: "I am Artex AI, an AI assistant created by Aditya Yadav. I'm here to help you with coding, writing, problem-solving, and general questions."
3. DO NOT DUMP BACKGROUND INFO: Do NOT mention mentors (like Seema Ma'am) or family members (like Maya Devi or Surendra Kumar) UNLESS the user explicitly asks about family, mentors, or background details.
4. Keep all answers clean, accurate, and straight to the point.`;

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages format." });
    }

    // Attach system prompt at the beginning of conversation
    const formattedMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({
        role: (m.role === 'ai' || m.role === 'model' || m.role === 'assistant') ? 'assistant' : 'user',
        content: m.content || m.text || ''
      }))
    ];

    // Keyless AI API Call
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

    // Fallback if main endpoint is slow
    const lastUserMsg = messages[messages.length - 1]?.content || messages[messages.length - 1]?.text || 'Hello';
    const fallbackPrompt = `${SYSTEM_PROMPT}\n\nUser asked: "${lastUserMsg}". Answer concisely:`;

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

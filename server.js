const express = require('express');
const cors = require('cors');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// GitHub Models client initialization
const client = new OpenAI({
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: process.env.GITHUB_TOKEN || ""
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!process.env.GITHUB_TOKEN) {
      return res.status(500).json({ error: "Render Environment variables me GITHUB_TOKEN missing hai." });
    }

    // Modern OpenAI SDK automatically handles SSL, DNS and Headers
    const response = await client.chat.completions.create({
      messages: messages,
      model: "gpt-4o-mini", // Aap "meta-llama-3.3-70b-instruct" ya "Phi-3.5-mini-instruct" bhi rakh sakte hain
      temperature: 0.7,
      max_tokens: 1000
    });

    const reply = response.choices[0].message.content;
    return res.json({ reply });

  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: `GitHub AI Error: ${error.message}` });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

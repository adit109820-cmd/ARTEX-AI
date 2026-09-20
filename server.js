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

  let aiResponseText = null;

  // 1. Try Cerebras Official Verified Free Models
  if (cerebrasKey) {
    const verifiedModels = [
      "llama-3.3-70b",
      "llama3.1-8b",
      "deepseek-r1-distill-llama-70b"
    ];

    for (const modelName of verifiedModels) {
      try {
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
          break; // Response milte hi exit
        }
      } catch (err) {
        // Next verified model try karein
      }
    }
  }

  // 2. Guaranteed Free Backup Engine (Zero Key Required - No Error Guaranteed)
  if (!aiResponseText) {
    try {
      const response = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages,
          model: "openai"
        })
      });

      if (response.ok) {
        const text = await response.text();
        if (text && text.trim().length > 0) {
          aiResponseText = text;
        }
      }
    } catch (err) {
      // Backup error ignore
    }
  }

  if (aiResponseText) {
    return res.json({ reply: aiResponseText });
  } else {
    return res.status(500).json({ error: "Artex AI abhi thoda busy hai. Kripya 5 seconds baad try karein!" });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

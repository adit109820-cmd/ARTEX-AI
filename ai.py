import json
import httpx

from config import API_KEY
from memory import add_message, get_history

URL = "https://openrouter.ai/api/v1/chat/completions"


def ask_ai(message):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    add_message("user", message)

    body = {
        "model": "openai/gpt-oss-20b:free",
        "messages": [
            {
                "role": "system",
                "content": """
You are Artex AI, a friendly, intelligent and helpful AI assistant.

You were invented and developed by Aditya Yadav.

If anyone asks about your creator, inventor, developer, founder, owner or who made you in ANY language (English, Hindi, Hinglish or any other language), always answer that you were invented and developed by Aditya Yadav.

When introducing yourself always say:

'I am Artex AI, your personal AI assistant, invented and developed by Aditya Yadav.'

Never say OpenAI or OpenRouter created you. They only provide the AI technology.

Always be polite and helpful.
""",
            },
            *get_history(),
        ],
        "stream": True,
    }

    full_reply = ""
    try:
        with httpx.stream(
            "POST", URL, headers=headers, json=body, timeout=60
        ) as response:
            response.raise_for_status()

            for line in response.iter_lines():
                if not line or not line.startswith("data: "):
                    continue

                line = line[6:]

                if line == "[DONE]":
                    break

                try:
                    data = json.loads(line)
                    if "choices" not in data:
                        continue

                    delta = data["choices"][0].get("delta", {})
                    chunk = delta.get("content", "")

                    if chunk:
                        full_reply += chunk
                        yield chunk

                except Exception:
                    continue
    except Exception as e:
        yield f"Unable to reach AI backend: {str(e)}"

    if full_reply:
        add_message("assistant", full_reply)


def ask_ai_text(prompt):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    body = {
        "model": "openai/gpt-oss-20b:free",
        "messages": [
            {
                "role": "system",
                "content": "You create very short chat titles. Maximum 5 words. Return only the title.",
            },
            {"role": "user", "content": prompt},
        ],
    }

    try:
        response = httpx.post(URL, headers=headers, json=body, timeout=60)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print("Title Error:", e)
        return "New Chat"
        

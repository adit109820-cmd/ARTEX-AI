import json
import os
import httpx

from memory import add_message, get_history

# OpenRouter API Endpoint
URL = "https://openrouter.ai/api/v1/chat/completions"


def get_key():
    # 1. Render Environment Variable se key lene ki koshish karein
    key = os.getenv("API_KEY", "")
    if key:
        return key

    # 2. Agar Render me nahi hai toh config.py se check karein
    try:
        from config import API_KEY as LOCAL_KEY

        return LOCAL_KEY
    except ImportError:
        return ""


def ask_ai(message):
    api_key = get_key()

    # API Key check
    if not api_key or "YOUR_OPENROUTER_API_KEY" in api_key:
        yield "❌ Error: OpenRouter API Key nahi mili! Render Dashboard me Environment Variable 'API_KEY' add karein."
        return

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://artex-ai-pljy.onrender.com",
        "X-Title": "Artex AI",
    }

    add_message("user", message)

    body = {
        "model": "meta-llama/llama-3.2-1b-instruct:free",
        "messages": [
            {
                "role": "system",
                "content": "You are Artex AI, a friendly and helpful AI assistant invented and developed by Aditya Yadav.",
            },
            *get_history(),
        ],
        "stream": True,
    }

    full_reply = ""

    try:
        with httpx.stream(
            "POST", URL, headers=headers, json=body, timeout=30.0
        ) as response:
            if response.status_code == 401:
                yield "❌ Error 401: Invalid API Key! OpenRouter par nayi API key banakar Render me add karein."
                return
            elif response.status_code != 200:
                yield f"❌ API Error ({response.status_code}): OpenRouter backend response fail ho gaya."
                return

            for line in response.iter_lines():
                if not line or not line.startswith("data: "):
                    continue

                line = line[6:]
                if line == "[DONE]":
                    break

                try:
                    data = json.loads(line)
                    if "choices" in data and len(data["choices"]) > 0:
                        chunk = data["choices"][0]["delta"].get("content", "")
                        if chunk:
                            full_reply += chunk
                            yield chunk
                except Exception:
                    continue

    except Exception as e:
        yield f"❌ Connection Error: {str(e)}"

    if full_reply:
        add_message("assistant", full_reply)


def ask_ai_text(prompt):
    api_key = get_key()
    if not api_key:
        return "New Chat"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    body = {
        "model": "meta-llama/llama-3.2-1b-instruct:free",
        "messages": [
            {
                "role": "system",
                "content": "Generate a short chat title (maximum 4 words). Return only title.",
            },
            {"role": "user", "content": prompt},
        ],
    }

    try:
        res = httpx.post(URL, headers=headers, json=body, timeout=15.0)
        if res.status_code == 200:
            return res.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        pass

    return "New Chat"
    

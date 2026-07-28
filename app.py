import json
import os
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import httpx

app = FastAPI(title="Artex AI Backend")

# Enable CORS for cross-origin access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-Memory History (Last 10 messages)
chat_history = []

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
# Reliable Free Model
MODEL_NAME = "meta-llama/llama-3.2-1b-instruct:free"


def add_to_history(role: str, content: str):
    global chat_history
    chat_history.append({"role": role, "content": content})
    if len(chat_history) > 10:
        chat_history = chat_history[-10:]


# Quick Offline Answers (Instant Reply without API call)
def get_quick_reply(text: str):
    msg = text.strip().lower()
    if msg in ["hi", "hello", "hey", "hii", "hlo", "hiii"]:
        return "Hello Boss! 👋 Main **Artex AI** hoon. Aaj main aapki kya madad kar sakta hoon?"
    if any(
        p in msg
        for p in [
            "who created you",
            "who made you",
            "kisine banaya",
            "creator",
            "owner",
            "developed you",
        ]
    ):
        return "Mujhe **Aditya Yadav** ne invent aur develop kiya hai! 🚀"
    if msg in ["kaise ho", "how are you", "how r u"]:
        return "Main bilkul badhiya hoon! Aap bataiye, aaj kya plan hai?"
    return None


async def generate_ai_stream(user_message: str):
    api_key = os.getenv("API_KEY", "").strip()

    if not api_key or "YOUR_OPENROUTER_API_KEY" in api_key:
        yield "⚠️ Error: OpenRouter API Key nahi mili! Render Dashboard -> Environment -> Add 'API_KEY'."
        return

    add_to_history("user", user_message)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://artex-ai.onrender.com",
        "X-Title": "Artex AI",
    }

    body = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "system",
                "content": "You are Artex AI, an intelligent, helpful, and polite AI assistant invented and developed by Aditya Yadav. Always respond politely.",
            },
            *chat_history,
        ],
        "stream": True,
    }

    full_response = ""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream(
                "POST", OPENROUTER_URL, headers=headers, json=body
            ) as response:
                if response.status_code == 401:
                    yield "⚠️ Error 401: Invalid API Key. Please check your OpenRouter API Key in Render."
                    return
                elif response.status_code != 200:
                    yield f"⚠️ API Error ({response.status_code}): OpenRouter backend currently busy."
                    return

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue

                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break

                    try:
                        data = json.loads(data_str)
                        if "choices" in data and len(data["choices"]) > 0:
                            chunk = (
                                data["choices"][0]
                                .get("delta", {})
                                .get("content", "")
                            )
                            if chunk:
                                full_response += chunk
                                yield chunk
                    except Exception:
                        continue

    except Exception as e:
        yield f"⚠️ Backend Connection Error: {str(e)}"

    if full_response:
        add_to_history("assistant", full_response)


# ---------------- API ROUTES ---------------- #


@app.get("/chat")
async def chat_endpoint(message: str = Query(...)):
    # Check offline quick reply first
    quick_reply = get_quick_reply(message)
    if quick_reply:

        async def quick_stream():
            yield quick_reply

        return StreamingResponse(
            quick_stream(), media_type="text/plain; charset=utf-8"
        )

    # Stream from AI
    return StreamingResponse(
        generate_ai_stream(message), media_type="text/plain; charset=utf-8"
    )


@app.get("/title")
async def title_endpoint(message: str = Query(...)):
    api_key = os.getenv("API_KEY", "").strip()
    if not api_key:
        return {"title": "New Chat"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "system",
                "content": "Generate a short chat title (max 4 words). Output only text.",
            },
            {"role": "user", "content": message},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(OPENROUTER_URL, headers=headers, json=body)
            if res.status_code == 200:
                title = res.json()["choices"][0]["message"]["content"].strip()
                return {"title": title}
    except Exception:
        pass

    return {"title": "New Chat"}


# Serve Static Frontend Files
@app.get("/")
async def serve_index():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"error": "index.html not found"}


@app.get("/{filename}")
async def serve_static(filename: str):
    if os.path.exists(filename):
        if filename.endswith(".css"):
            return FileResponse(filename, media_type="text/css")
        elif filename.endswith(".js"):
            return FileResponse(filename, media_type="application/javascript")
        return FileResponse(filename)
    return FileResponse("index.html")
    

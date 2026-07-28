import json
import os
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import httpx

app = FastAPI(title="Artex AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chat_history = []
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL_NAME = "meta-llama/llama-3.2-1b-instruct:free"


def add_to_history(role: str, content: str):
    global chat_history
    chat_history.append({"role": role, "content": content})
    if len(chat_history) > 10:
        chat_history = chat_history[-10:]


def get_quick_reply(text: str):
    msg = text.strip().lower()
    if msg in ["hi", "hello", "hey", "hii", "hlo"]:
        return "Hello Boss! 👋 Main **Artex AI** hoon. Aaj main aapki kya madad kar sakta hoon?"
    if any(
        p in msg
        for p in [
            "who created you",
            "who made you",
            "creator",
            "owner",
            "developed you",
        ]
    ):
        return "Mujhe **Aditya Yadav** ne invent aur develop kiya hai! 🚀"
    if msg in ["kaise ho", "how are you"]:
        return "Main bilkul badhiya hoon! Aap bataiye, aaj kya plan hai?"
    return None


async def generate_ai_stream(user_message: str):
    api_key = os.getenv("API_KEY", "").strip()

    if not api_key:
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
                "content": "You are Artex AI, an intelligent assistant developed by Aditya Yadav.",
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
                if response.status_code != 200:
                    yield f"⚠️ API Error ({response.status_code})"
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
        yield f"⚠️ Connection Error: {str(e)}"

    if full_response:
        add_to_history("assistant", full_response)


# --- ROUTES ---


@app.get("/chat")
async def chat_endpoint(message: str = Query(...)):
    quick_reply = get_quick_reply(message)
    if quick_reply:

        async def quick_stream():
            yield quick_reply

        return StreamingResponse(
            quick_stream(), media_type="text/plain; charset=utf-8"
        )

    return StreamingResponse(
        generate_ai_stream(message), media_type="text/plain; charset=utf-8"
    )


@app.get("/")
async def serve_home():
    return FileResponse("index.html")


# Mount all static assets (CSS, JS, images)
app.mount("/", StaticFiles(directory=".", html=True), name="static")

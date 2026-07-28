import time
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from ai import ask_ai, ask_ai_text
from brain import basic_reply

app = FastAPI(title="Artex AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 1. Main Link par Index.html Open Hoga
@app.get("/")
def home():
    return FileResponse("index.html")


# 2. Chat Streaming API
@app.get("/chat")
def chat(message: str):
    reply = basic_reply(message)

    if reply is not None:

        def basic_stream():
            yield reply

        return StreamingResponse(basic_stream(), media_type="text/plain")

    return StreamingResponse(ask_ai(message), media_type="text/plain")


# 3. Chat Title Generator API
@app.get("/title")
def title(message: str):
    prompt = f"""
Generate a short chat title (maximum 5 words).

User Message:
{message}

Return only the title.
"""
    return {"title": ask_ai_text(prompt)}


# 4. CSS, JS aur baaki Static Files serve karne ke liye
app.mount("/", StaticFiles(directory=".", html=True), name="static")


import time
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
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


# Main Web UI Serve karne ke liye
@app.get("/")
def home():
    return FileResponse("index.html")


# Chat Streaming API Route
@app.get("/chat")
def chat(message: str):
    reply = basic_reply(message)

    if reply is not None:

        def basic_stream():
            yield reply

        return StreamingResponse(basic_stream(), media_type="text/plain")

    return StreamingResponse(ask_ai(message), media_type="text/plain")


# Chat Title Generator API Route
@app.get("/title")
def title(message: str):
    prompt = f"Generate a short chat title (maximum 5 words).\n\nUser Message:\n{message}\n\nReturn only the title."
    return {"title": ask_ai_text(prompt)}


# Test Route for Stream Verification
@app.get("/test")
def test():
    def generate():
        words = ["Hello ", "Boss! ", "This ", "is ", "real ", "streaming."]
        for word in words:
            yield word
            time.sleep(0.5)

    return StreamingResponse(generate(), media_type="text/plain")


# Static Files (CSS/JS) Serve Karne Ke Liye (Aakhir me hi rakhein)
app.mount("/", StaticFiles(directory=".", html=True), name="static")

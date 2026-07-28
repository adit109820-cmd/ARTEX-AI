from fastapi.responses import StreamingResponse
from ai import ask_ai, ask_ai_text
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from brain import basic_reply
import time

app = FastAPI(title="Artex AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "status": "online",
        "message": "Welcome Boss! Artex AI Backend is Running."
    }


@app.get("/chat")
def chat(message: str):

    reply = basic_reply(message)

    if reply is not None:

        def basic_stream():
            yield reply

        return StreamingResponse(
            basic_stream(),
            media_type="text/plain"
        )

    return StreamingResponse(
        ask_ai(message),
        media_type="text/plain"
    )


@app.get("/test")
def test():

    def generate():
        for word in ["Hello ", "Boss! ", "This ", "is ", "streaming."]:
            yield word
            time.sleep(0.5)

    return StreamingResponse(
        generate(),
        media_type="text/plain"
    )
@app.get("/title")
def title(message: str):

    prompt = f"""
Generate a very short chat title (maximum 5 words).

User message:
{message}

Only return the title.
"""

    return {
        "title": ask_ai_text(prompt)
    }
@app.get("/title")
def title(message: str):

    prompt = f"""
Generate a short chat title (maximum 5 words).

User Message:
{message}

Return only the title.
"""

    return {
        "title": ask_ai_text(prompt)
    }
from fastapi.responses import StreamingResponse
import time

@app.get("/test")
def test():

    def generate():
        words = ["Hello ", "Boss! ", "This ", "is ", "real ", "streaming."]

        for word in words:
            yield word
            time.sleep(0.5)

    return StreamingResponse(generate(), media_type="text/plain")
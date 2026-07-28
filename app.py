import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

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


@app.get("/")
def home():
    return FileResponse("index.html")


@app.get("/style.css")
def get_css():
    return FileResponse("style.css", media_type="text/css")


@app.get("/script.js")
def get_js():
    return FileResponse("script.js", media_type="application/javascript")


@app.get("/chat")
def chat(message: str):
    reply = basic_reply(message)

    if reply is not None:

        def basic_stream():
            yield reply

        return StreamingResponse(basic_stream(), media_type="text/plain")

    return StreamingResponse(ask_ai(message), media_type="text/plain")


@app.get("/title")
def title(message: str):
    prompt = f"Generate a short chat title (maximum 5 words).\n\nUser Message:\n{message}\n\nReturn only the title."
    return {"title": ask_ai_text(prompt)}
    

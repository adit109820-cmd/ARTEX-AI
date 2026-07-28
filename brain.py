from datetime import datetime


def basic_reply(message):
    text = message.lower().strip()

    if text in ["hi", "hello", "hey"]:
        return "Hello Boss! 👋"

    elif text == "how are you":
        return "I'm doing great! How can I help you today?"

    elif text == "who are you":
        return """I am Artex AI, your personal AI assistant.

Designed and developed by Aditya Yadav.

I'm here to help with coding, learning, writing, and solving problems."""

    elif text == "time":
        return "Current Time: " + datetime.now().strftime("%I:%M %p")

    elif text == "date":
        return "Today's Date: " + datetime.now().strftime("%d-%m-%Y")

    elif text == "day":
        return "Today is " + datetime.now().strftime("%A")

    elif text == "bye":
        return "Goodbye Boss! Have a great day."

    # Simple Safe Math Calculation
    try:
        allowed = set("0123456789+-*/(). ")
        if set(text).issubset(allowed) and any(c.isdigit() for c in text):
            return f"Answer: {eval(text)}"
        return None
    except Exception:
        return None
        

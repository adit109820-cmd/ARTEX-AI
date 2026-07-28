history = []


def add_message(role: str, content: str):
    global history
    history.append({"role": role, "content": content})
    # Context window: Keep last 10 messages only
    if len(history) > 10:
        history = history[-10:]


def get_history():
    return history


def clear_history():
    global history
    history = []
    

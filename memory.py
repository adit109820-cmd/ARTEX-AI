chat_history = []


def add_message(role, text):
    chat_history.append({"role": role, "content": text})

    # Last 20 messages memory
    if len(chat_history) > 20:
        chat_history.pop(0)


def get_history():
    return chat_history


def clear_history():
    chat_history.clear()
    

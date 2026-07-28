def basic_reply(message: str):
    msg = message.strip().lower()

    if msg in ["hi", "hello", "hey", "hii", "hlo"]:
        return "Hello Boss! 👋 Main **Artex AI** hoon. Aaj main aapki kya madad kar sakta hoon?"

    elif any(
        phrase in msg
        for phrase in [
            "who created you",
            "who made you",
            "kisine banaya",
            "creator",
            "owner",
        ]
    ):
        return "Mujhe **Aditya Yadav** ne invent aur develop kiya hai! 🚀"

    elif msg in ["kaise ho", "how are you", "how r u"]:
        return "Main bilkul badhiya hoon! Aap bataiye, aaj kya plan hai?"

    return None
    

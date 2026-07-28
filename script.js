document.addEventListener("DOMContentLoaded", () => {
    const chatBox = document.getElementById("chat-box");
    const welcomeScreen = document.getElementById("welcome-screen");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const stopBtn = document.getElementById("stop-btn");
    const newChatBtn = document.getElementById("new-chat");
    const menuBtn = document.getElementById("menu-btn");
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("backdrop");

    let currentController = null;

    // Auto Resize Textarea
    userInput.addEventListener("input", () => {
        userInput.style.height = "auto";
        userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
    });

    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn.addEventListener("click", sendMessage);

    if (stopBtn) {
        stopBtn.addEventListener("click", () => {
            if (currentController) {
                currentController.abort();
                toggleButtons(false);
            }
        });
    }

    // Sidebar Controls
    menuBtn.addEventListener("click", () => {
        sidebar.classList.toggle("show");
        backdrop.classList.toggle("show");
    });

    backdrop.addEventListener("click", () => {
        sidebar.classList.remove("show");
        backdrop.classList.remove("show");
    });

    newChatBtn.addEventListener("click", () => {
        chatBox.innerHTML = "";
        chatBox.appendChild(welcomeScreen);
        welcomeScreen.style.display = "block";
        userInput.value = "";
        userInput.style.height = "auto";
    });

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        if (welcomeScreen) welcomeScreen.style.display = "none";

        appendMessage("user", text);
        userInput.value = "";
        userInput.style.height = "auto";

        toggleButtons(true);
        const botMsgDiv = appendMessage("bot", "Thinking...");

        currentController = new AbortController();

        try {
            const response = await fetch(`/chat?message=${encodeURIComponent(text)}`, {
                signal: currentController.signal
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            botMsgDiv.innerHTML = "";
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                fullText += decoder.decode(value, { stream: true });

                if (window.marked) {
                    botMsgDiv.innerHTML = marked.parse(fullText);
                } else {
                    botMsgDiv.textContent = fullText;
                }

                chatBox.scrollTop = chatBox.scrollHeight;
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                botMsgDiv.innerHTML += "<br><em>[Stopped]</em>";
            } else {
                botMsgDiv.innerHTML = `<span style="color: #f87171;">⚠️ Connection Error: ${error.message}</span>`;
            }
        } finally {
            toggleButtons(false);
            currentController = null;
        }
    }

    function appendMessage(role, text) {
        const div = document.createElement("div");
        div.className = role === "user" ? "user-msg" : "bot-msg";
        div.textContent = text;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
        return div;
    }

    function toggleButtons(isGenerating) {
        sendBtn.style.display = isGenerating ? "none" : "flex";
        stopBtn.style.display = isGenerating ? "flex" : "none";
    }
});

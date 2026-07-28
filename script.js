const API = {
    CHAT: "/chat",
    TITLE: "/title"
};

let currentController = null;

document.addEventListener("DOMContentLoaded", () => {
    const chatBox = document.querySelector(".chat-box");
    const textarea = document.querySelector("textarea");
    const sendBtn = document.getElementById("send-btn");
    const stopBtn = document.querySelector(".stop-btn");
    const newChatBtn = document.querySelector(".new-chat");
    const menuBtn = document.querySelector(".menu-btn");
    const sidebar = document.querySelector(".sidebar");
    const backdrop = document.querySelector(".sidebar-backdrop");

    // Textarea Auto Height
    textarea.addEventListener("input", () => {
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    });

    textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    if (sendBtn) sendBtn.addEventListener("click", sendMessage);

    if (stopBtn) {
        stopBtn.addEventListener("click", () => {
            if (currentController) {
                currentController.abort();
                toggleButtons(false);
            }
        });
    }

    if (menuBtn && sidebar && backdrop) {
        menuBtn.addEventListener("click", () => sidebar.classList.toggle("show"));
        backdrop.addEventListener("click", () => sidebar.classList.remove("show"));
    }

    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => {
            chatBox.innerHTML = "";
            textarea.value = "";
            textarea.style.height = "auto";
        });
    }

    async function sendMessage() {
        const text = textarea.value.trim();
        if (!text) return;

        appendMessage("user", text);
        textarea.value = "";
        textarea.style.height = "auto";

        toggleButtons(true);

        const botMsgDiv = appendMessage("bot", "Thinking...");
        currentController = new AbortController();

        try {
            const response = await fetch(`${API.CHAT}?message=${encodeURIComponent(text)}`, {
                signal: currentController.signal
            });

            if (!response.ok) {
                throw new Error(`Server Status: ${response.status}`);
            }

            botMsgDiv.innerHTML = "";
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;

                if (window.marked) {
                    botMsgDiv.innerHTML = marked.parse(fullText);
                } else {
                    botMsgDiv.textContent = fullText;
                }

                chatBox.scrollTop = chatBox.scrollHeight;
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                botMsgDiv.innerHTML += " <br><em>[Stopped]</em>";
            } else {
                botMsgDiv.innerHTML = `<span style="color: #f87171;">⚠️ ${error.message}. Connection failed.</span>`;
            }
        } finally {
            toggleButtons(false);
            currentController = null;
        }
    }

    function appendMessage(role, text) {
        const div = document.createElement("div");
        div.className = role === "user" ? "user-message" : "bot-message";
        div.textContent = text;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
        return div;
    }

    function toggleButtons(isGenerating) {
        if (sendBtn) sendBtn.style.display = isGenerating ? "none" : "block";
        if (stopBtn) stopBtn.style.display = isGenerating ? "block" : "none";
    }
});
            

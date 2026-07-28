"use strict";

// ===========================================
// App State
// ===========================================

const App = {
    chats: [],
    currentChat: 0,
    controller: null,
    isGenerating: false,
    currentBubble: null,
    currentBotMessage: null
};

// ===========================================
// DOM Elements
// ===========================================

const menuBtn = document.querySelector(".menu-btn");
const sidebar = document.querySelector(".sidebar");
const stopBtn = document.querySelector(".stop-btn");
const sendBtn = document.querySelector("#send-btn");
const input = document.querySelector(".input-area textarea");
const chatBox = document.querySelector(".chat-box");
const newChatBtn = document.querySelector(".new-chat");
const chatList = document.getElementById("chat-list");

// ===========================================
// Backend Relative URLs (Works on Local & Render)
// ===========================================

const API = {
    CHAT: "/chat",
    TITLE: "/title"
};

// ===========================================
// Local Storage Management
// ===========================================

function saveChats() {
    localStorage.setItem("chats", JSON.stringify(App.chats));
}

function loadChats() {
    const saved = localStorage.getItem("chats");
    if (saved) {
        App.chats = JSON.parse(saved);
    } else {
        App.chats = [
            {
                title: "New Chat",
                messages: []
            }
        ];
    }
    App.currentChat = App.chats.length - 1;
}

// ===========================================
// Utilities
// ===========================================

function scrollBottom() {
    requestAnimationFrame(() => {
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

function clearChat() {
    chatBox.innerHTML = "";
}

// Textarea Auto-Resize as user types
input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 170) + "px";
});

// ===========================================
// Bubble Factory
// ===========================================

function createBubble(sender, text) {
    const bubble = document.createElement("div");
    bubble.className = sender === "user" ? "user-message" : "bot-message";

    if (sender === "bot") {
        bubble.innerHTML = marked.parse(text || "");
    } else {
        bubble.textContent = text;
    }

    return bubble;
}

// ===========================================
// Display Messages
// ===========================================

function displayMessages() {
    clearChat();

    const messages = App.chats[App.currentChat]?.messages || [];

    if (messages.length === 0) {
        const welcomeBubble = createBubble("bot", "Hello Boss! 👋 How can I help you today?");
        chatBox.appendChild(welcomeBubble);
        return;
    }

    messages.forEach(msg => {
        const bubble = createBubble(msg.sender, msg.text);
        chatBox.appendChild(bubble);
    });

    hljs.highlightAll();
    addCopyButtons();
    scrollBottom();
}

// ===========================================
// History & Sidebar Rendering
// ===========================================

function displayHistory() {
    chatList.innerHTML = "";

    App.chats.forEach((chat, index) => {
        const item = document.createElement("div");
        item.className = index === App.currentChat ? "chat-item active" : "chat-item";

        // Title
        const title = document.createElement("span");
        title.className = "chat-title";
        title.textContent = chat.title || "New Chat";

        // 3-Dots Menu Button
        const menuBtn = document.createElement("button");
        menuBtn.className = "chat-menu-btn";
        menuBtn.textContent = "⋮";

        // Context Menu Popup
        const menu = document.createElement("div");
        menu.className = "chat-menu";
        menu.innerHTML = `
            <button class="rename">Rename</button>
            <button class="duplicate">Duplicate</button>
            <button class="export">Export</button>
            <button class="danger delete">Delete</button>
        `;

        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = menu.style.display === "flex";
            
            document.querySelectorAll(".chat-menu").forEach(m => m.style.display = "none");
            menu.style.display = isOpen ? "none" : "flex";
        });

        menu.querySelector(".rename").onclick = (e) => {
            e.stopPropagation();
            menu.style.display = "none";
            renameChat(index);
        };

        menu.querySelector(".duplicate").onclick = (e) => {
            e.stopPropagation();
            menu.style.display = "none";
            duplicateChat(index);
        };

        menu.querySelector(".export").onclick = (e) => {
            e.stopPropagation();
            menu.style.display = "none";
            exportChat(index);
        };

        menu.querySelector(".delete").onclick = (e) => {
            e.stopPropagation();
            menu.style.display = "none";
            deleteChat(index);
        };

        item.onclick = () => {
            App.currentChat = index;
            displayMessages();
            displayHistory();
        };

        item.appendChild(title);
        item.appendChild(menuBtn);
        item.appendChild(menu);
        chatList.appendChild(item);
    });
}

// ===========================================
// Chat Management Functions
// ===========================================

function renameChat(index) {
    const item = chatList.children[index];
    if (!item) return;

    const title = item.querySelector(".chat-title");
    const renameInput = document.createElement("input");
    renameInput.className = "rename-input";
    renameInput.value = App.chats[index].title;

    title.replaceWith(renameInput);
    renameInput.focus();
    renameInput.select();

    function save() {
        const value = renameInput.value.trim();
        if (value) {
            App.chats[index].title = value;
            saveChats();
        }
        displayHistory();
    }

    renameInput.addEventListener("blur", save);
    renameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") renameInput.blur();
    });
}

function deleteChat(index) {
    if (!confirm("Delete this chat?")) return;

    App.chats.splice(index, 1);

    if (App.chats.length === 0) {
        App.chats.push({ title: "New Chat", messages: [] });
    }

    if (App.currentChat >= App.chats.length) {
        App.currentChat = App.chats.length - 1;
    }

    saveChats();
    displayHistory();
    displayMessages();
}

function duplicateChat(index) {
    const copy = JSON.parse(JSON.stringify(App.chats[index]));
    copy.title += " (Copy)";
    App.chats.splice(index + 1, 0, copy);
    App.currentChat = index + 1;

    saveChats();
    displayHistory();
    displayMessages();
}

function exportChat(index) {
    const chat = App.chats[index];
    let text = chat.title + "\n\n";

    chat.messages.forEach(msg => {
        text += (msg.sender === "user" ? "You: " : "Artex AI: ") + msg.text + "\n\n";
    });

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chat.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function newChat() {
    const currentMessages = App.chats[App.currentChat]?.messages;
    if (currentMessages && currentMessages.length === 0) {
        sidebar.classList.remove("show");
        return;
    }

    App.chats.push({
        title: "New Chat",
        messages: []
    });

    App.currentChat = App.chats.length - 1;
    saveChats();
    displayHistory();
    displayMessages();
    sidebar.classList.remove("show");
}

// ===========================================
// Code Block Copy Buttons
// ===========================================

function addCopyButtons() {
    document.querySelectorAll("pre code").forEach(block => {
        const pre = block.parentElement;
        if (pre.querySelector(".copy-btn")) return;

        const btn = document.createElement("button");
        btn.className = "copy-btn";
        btn.innerText = "📋 Copy";

        btn.onclick = () => {
            navigator.clipboard.writeText(block.innerText);
            btn.innerText = "✅ Copied";
            setTimeout(() => {
                btn.innerText = "📋 Copy";
            }, 2000);
        };

        pre.style.position = "relative";
        pre.appendChild(btn);
    });
}

// ===========================================
// Send Message & Streaming Logic
// ===========================================

async function sendMessage() {
    if (App.isGenerating) return;

    const message = input.value.trim();
    if (message === "") return;

    App.isGenerating = true;
    sidebar.classList.remove("show");
    input.value = "";
    input.style.height = "auto";

    // 1. Add User Message
    App.chats[App.currentChat].messages.push({
        sender: "user",
        text: message
    });

    // 2. Title Generator for 1st message
    if (App.chats[App.currentChat].messages.length === 1) {
        fetch(API.TITLE + "?message=" + encodeURIComponent(message))
            .then(res => res.json())
            .then(data => {
                if (data.title) {
                    App.chats[App.currentChat].title = data.title;
                    displayHistory();
                    saveChats();
                }
            })
            .catch(() => {
                App.chats[App.currentChat].title = message.substring(0, 25);
                displayHistory();
                saveChats();
            });
    }

    // 3. Add Empty Bot Message
    App.currentBotMessage = {
        sender: "bot",
        text: ""
    };

    App.chats[App.currentChat].messages.push(App.currentBotMessage);
    displayMessages();
    saveChats();

    App.currentBubble = chatBox.lastElementChild;
    App.controller = new AbortController();
    
    if (sendBtn) sendBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "inline-block";

    try {
        const response = await fetch(API.CHAT + "?message=" + encodeURIComponent(message), {
            signal: App.controller.signal
        });

        if (!response.ok) throw new Error("Server Error");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        await startStreaming(reader, decoder);

    } catch (error) {
        if (error.name !== "AbortError") {
            App.currentBotMessage.text = "Unable to connect to Artex AI Backend.";
            displayMessages();
        }
    } finally {
        finalizeCurrentBubble();
        displayHistory();
        if (stopBtn) stopBtn.style.display = "none";
        if (sendBtn) sendBtn.style.display = "inline-block";
        App.controller = null;
        App.isGenerating = false;
        saveChats();
    }
}

// ===========================================
// Real Streaming Engine
// ===========================================

async function startStreaming(reader, decoder) {
    let fullReply = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;

        fullReply += chunk;
        App.currentBotMessage.text = fullReply;
        updateCurrentBubble(fullReply);
    }
}

function updateCurrentBubble(text) {
    if (!App.currentBubble) return;
    App.currentBubble.textContent = text;
    scrollBottom();
}

function finalizeCurrentBubble() {
    if (!App.currentBubble) return;
    App.currentBubble.innerHTML = marked.parse(App.currentBotMessage.text || "");
    hljs.highlightAll();
    addCopyButtons();
    scrollBottom();
}

// ===========================================
// Event Listeners
// ===========================================

if (sendBtn) sendBtn.addEventListener("click", sendMessage);
if (newChatBtn) newChatBtn.addEventListener("click", newChat);

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

if (stopBtn) {
    stopBtn.addEventListener("click", () => {
        if (App.controller) {
            App.controller.abort();
        }
    });
}

if (menuBtn) {
    menuBtn.addEventListener("click", () => {
        sidebar.classList.toggle("show");
    });
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".chat-menu") && !e.target.closest(".chat-menu-btn")) {
        document.querySelectorAll(".chat-menu").forEach(m => m.style.display = "none");
    }

    if (
        window.innerWidth <= 768 &&
        sidebar.classList.contains("show") &&
        !sidebar.contains(e.target) &&
        !menuBtn.contains(e.target)
    ) {
        sidebar.classList.remove("show");
    }
});

// ===========================================
// App Initialization
// ===========================================

loadChats();
displayHistory();
displayMessages();
                      

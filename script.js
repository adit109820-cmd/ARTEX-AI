"use strict";

// ===========================================
// Application State
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
const backdrop = document.querySelector(".sidebar-backdrop");
const stopBtn = document.querySelector(".stop-btn");
const sendBtn = document.querySelector("#send-btn");
const input = document.querySelector(".input-area textarea");
const chatBox = document.querySelector(".chat-box");
const newChatBtn = document.querySelector(".new-chat");
const chatList = document.getElementById("chat-list");

// Relative Endpoints for Render/Localhost compatibility
const API = {
    CHAT: "/chat",
    TITLE: "/title"
};

// ===========================================
// Storage
// ===========================================

function saveChats() {
    localStorage.setItem("artex_chats", JSON.stringify(App.chats));
}

function loadChats() {
    const saved = localStorage.getItem("artex_chats");
    if (saved) {
        try {
            App.chats = JSON.parse(saved);
        } catch (e) {
            App.chats = [];
        }
    }
    if (!App.chats || App.chats.length === 0) {
        App.chats = [{ title: "New Chat", messages: [] }];
    }
    App.currentChat = App.chats.length - 1;
}

// ===========================================
// Helpers
// ===========================================

function scrollBottom() {
    requestAnimationFrame(() => {
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

function clearChat() {
    chatBox.innerHTML = "";
}

function closeSidebarMobile() {
    if (window.innerWidth <= 768) {
        sidebar.classList.remove("show");
    }
}

// Auto Resize Input Area
input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 150) + "px";
});

// ===========================================
// Render Chat UI
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

function displayMessages() {
    clearChat();
    const messages = App.chats[App.currentChat]?.messages || [];

    if (messages.length === 0) {
        const welcome = createBubble("bot", "Hello Boss! 👋 Main Artex AI hoon. Aaj main aapki kya help karoon?");
        chatBox.appendChild(welcome);
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

function displayHistory() {
    chatList.innerHTML = "";

    App.chats.forEach((chat, index) => {
        const item = document.createElement("div");
        item.className = index === App.currentChat ? "chat-item active" : "chat-item";

        const title = document.createElement("span");
        title.className = "chat-title";
        title.textContent = chat.title || "New Chat";

        const menuBtn = document.createElement("button");
        menuBtn.className = "chat-menu-btn";
        menuBtn.textContent = "⋮";

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

        menu.querySelector(".rename").onclick = (e) => { e.stopPropagation(); menu.style.display = "none"; renameChat(index); };
        menu.querySelector(".duplicate").onclick = (e) => { e.stopPropagation(); menu.style.display = "none"; duplicateChat(index); };
        menu.querySelector(".export").onclick = (e) => { e.stopPropagation(); menu.style.display = "none"; exportChat(index); };
        menu.querySelector(".delete").onclick = (e) => { e.stopPropagation(); menu.style.display = "none"; deleteChat(index); };

        item.onclick = () => {
            App.currentChat = index;
            displayMessages();
            displayHistory();
            closeSidebarMobile();
        };

        item.appendChild(title);
        item.appendChild(menuBtn);
        item.appendChild(menu);
        chatList.appendChild(item);
    });
}

// ===========================================
// Chat History Operations
// ===========================================

function renameChat(index) {
    const item = chatList.children[index];
    if (!item) return;

    const titleSpan = item.querySelector(".chat-title");
    const renameInput = document.createElement("input");
    renameInput.className = "rename-input";
    renameInput.value = App.chats[index].title;

    titleSpan.replaceWith(renameInput);
    renameInput.focus();
    renameInput.select();

    function save() {
        const val = renameInput.value.trim();
        if (val) {
            App.chats[index].title = val;
            saveChats();
        }
        displayHistory();
    }

    renameInput.addEventListener("blur", save);
    renameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") renameInput.blur(); });
}

function deleteChat(index) {
    if (!confirm("Is chat ko delete karein?")) return;
    App.chats.splice(index, 1);
    if (App.chats.length === 0) App.chats.push({ title: "New Chat", messages: [] });
    if (App.currentChat >= App.chats.length) App.currentChat = App.chats.length - 1;

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
    const currentMsgs = App.chats[App.currentChat]?.messages;
    if (currentMsgs && currentMsgs.length === 0) {
        closeSidebarMobile();
        return;
    }

    App.chats.push({ title: "New Chat", messages: [] });
    App.currentChat = App.chats.length - 1;
    saveChats();
    displayHistory();
    displayMessages();
    closeSidebarMobile();
}

function addCopyButtons() {
    document.querySelectorAll("pre code").forEach(block => {
        const pre = block.parentElement;
        if (pre.querySelector(".copy-btn")) return;

        const btn = document.createElement("button");
        btn.className = "copy-btn";
        btn.innerText = "Copy";

        btn.onclick = () => {
            navigator.clipboard.writeText(block.innerText);
            btn.innerText = "Copied!";
            setTimeout(() => { btn.innerText = "Copy"; }, 2000);
        };

        pre.style.position = "relative";
        pre.appendChild(btn);
    });
}

// ===========================================
// Send Message Logic
// ===========================================

async function sendMessage() {
    if (App.isGenerating) return;

    const message = input.value.trim();
    if (message === "") return;

    App.isGenerating = true;
    closeSidebarMobile();
    input.value = "";
    input.style.height = "auto";

    // 1. Add User Message
    App.chats[App.currentChat].messages.push({ sender: "user", text: message });

    // 2. Generate Chat Title on 1st Message
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
                App.chats[App.currentChat].title = message.substring(0, 20);
                displayHistory();
                saveChats();
            });
    }

    // 3. Add Empty Bot Message
    App.currentBotMessage = { sender: "bot", text: "" };
    App.chats[App.currentChat].messages.push(App.currentBotMessage);
    displayMessages();
    saveChats();

    App.currentBubble = chatBox.lastElementChild;
    App.controller = new AbortController();

    if (sendBtn) sendBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "flex";

    try {
        const response = await fetch(API.CHAT + "?message=" + encodeURIComponent(message), {
            signal: App.controller.signal
        });

        if (!response.ok) throw new Error("Server Error");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullReply = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            if (!chunk) continue;

            fullReply += chunk;
            App.currentBotMessage.text = fullReply;
            if (App.currentBubble) {
                App.currentBubble.textContent = fullReply;
                scrollBottom();
            }
        }

    } catch (error) {
        if (error.name !== "AbortError") {
            App.currentBotMessage.text = "Server se connect karne me problem hui.";
            displayMessages();
        }
    } finally {
        if (App.currentBubble) {
            App.currentBubble.innerHTML = marked.parse(App.currentBotMessage.text || "");
            hljs.highlightAll();
            addCopyButtons();
            scrollBottom();
        }
        displayHistory();
        if (stopBtn) stopBtn.style.display = "none";
        if (sendBtn) sendBtn.style.display = "flex";
        App.controller = null;
        App.isGenerating = false;
        saveChats();
    }
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
        if (App.controller) App.controller.abort();
    });
}

if (menuBtn) {
    menuBtn.addEventListener("click", () => {
        sidebar.classList.toggle("show");
    });
}

if (backdrop) {
    backdrop.addEventListener("click", () => {
        sidebar.classList.remove("show");
    });
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".chat-menu") && !e.target.closest(".chat-menu-btn")) {
        document.querySelectorAll(".chat-menu").forEach(m => m.style.display = "none");
    }
});

// App Initialize
loadChats();
displayHistory();
displayMessages();
                                 

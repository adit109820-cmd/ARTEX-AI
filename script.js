const input = document.querySelector(".input-area input");
const sendBtn = document.querySelector(".input-area button");
const chatBox = document.querySelector(".chat-box");
const newChatBtn = document.querySelector(".new-chat");
function sendMessage() {

    const message = input.value.trim();

    if(message === ""){
        return;
    }

    // User Message
    const userMsg = document.createElement("div");
    userMsg.className = "user-message";
    userMsg.textContent = message;

    chatBox.appendChild(userMsg);

    input.value = "";

    // Demo AI Reply
    const thinking = document.createElement("div");
thinking.className = "bot-message";
thinking.textContent = "Thinking...";

chatBox.appendChild(thinking);

chatBox.scrollTop = chatBox.scrollHeight;

setTimeout(() => {

    thinking.textContent = "Hello Boss! I received your message: " + message;

    chatBox.scrollTop = chatBox.scrollHeight;

},1000);

}

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keypress", function(e){

    if(e.key === "Enter"){
        sendMessage();
    }

});
newChatBtn.addEventListener("click", () => {

    chatBox.innerHTML = "";

});
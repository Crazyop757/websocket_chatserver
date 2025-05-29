let ws;

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.querySelector('.chat-input');
    const sendBtn = document.querySelector('.send-btn');
    const chatMessages = document.querySelector('.chat-messages');

    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join', room: room, user: username }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const newMessage = document.createElement('div');
        newMessage.className = 'message';
        newMessage.innerHTML = `
            <div class="message-avatar">${msg.user[0].toUpperCase()}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${msg.user}</span>
                    <span class="message-time">Just now</span>
                </div>
                <div class="message-text">${escapeHtml(msg.text)}</div>
            </div>`;
        chatMessages.appendChild(newMessage);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Optional: Remove message element after 30 seconds for UX
        setTimeout(() => {
            newMessage.remove();
        }, 30);
    };

    const sendWebSocketMessage = () => {
        const text = chatInput.value.trim();
        if (text && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'chat', room: room, text: text }));
            chatInput.value = '';
        }
    };

    const escapeHtml = (unsafe) => {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    sendBtn.addEventListener('click', sendWebSocketMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendWebSocketMessage();
    });
});

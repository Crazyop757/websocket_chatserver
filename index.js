const WebSocket = require('ws');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 8080;
const server = require('http').createServer();
const wss = new WebSocket.Server({ server });

server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

const uri = process.env.MONGO_URI;
 // Replace with your Atlas URI
const client = new MongoClient(uri);

let messagesCollection;
const rooms = {}; 

async function initDB() {
  try {
    await client.connect();
    const db = client.db('chatdb');
    messagesCollection = db.collection('messages');

    // TTL index to auto-delete messages 30 seconds after creation
    await messagesCollection.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 30 });

    console.log('Connected to MongoDB and TTL index created');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

initDB();

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      console.error('Invalid JSON:', message);
      return;
    }

    if (msg.type === 'join') {
      if (!msg.user || !msg.room) {
        console.warn('Join message missing user or room:', msg);
        return;
      }

      ws.username = msg.user;
      ws.room = msg.room;

      if (!rooms[msg.room]) {
        rooms[msg.room] = new Set();
      }
      rooms[msg.room].add(ws);

      console.log(`User '${ws.username}' joined room '${ws.room}'. Users in room: ${rooms[msg.room].size}`);

      // Send last 50 messages from DB to this user
      try {
        const recentMessages = await messagesCollection.find({ room: msg.room })
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray();

        // Send in chronological order
        recentMessages.reverse().forEach(m => {
          ws.send(JSON.stringify({ user: m.user, text: m.text }));
        });
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    }

    else if (msg.type === 'chat') {
      if (!ws.username || !ws.room || !msg.text) return;

      const chatMessage = {
        user: ws.username,
        room: ws.room,
        text: msg.text,
        createdAt: new Date()
      };

      try {
        await messagesCollection.insertOne(chatMessage);
      } catch (err) {
        console.error('Failed to save message:', err);
      }

      // Broadcast to all users in the room
      if (rooms[ws.room]) {
        rooms[ws.room].forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ user: chatMessage.user, text: chatMessage.text }));
          }
        });
      }
    }
  });

  ws.on('close', () => {
    if (ws.room && rooms[ws.room]) {
      rooms[ws.room].delete(ws);
      if (rooms[ws.room].size === 0) {
        delete rooms[ws.room];
      }
      console.log(`User '${ws.username}' left room '${ws.room}'. Remaining users: ${rooms[ws.room]?.size || 0}`);
    }
  });
});

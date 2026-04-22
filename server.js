const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

const WORDS_A = [
  "Goat", "Rusty", "Neon", "Broken", "Happy", "Sleepy",
  "Tiny", "Mega", "Silly", "Wobbly", "Cloud", "Pixel"
];

const WORDS_B = [
  "Clown", "Cube", "Bean", "Ghost", "Wizard", "Thing",
  "Goober", "Buddy", "Goblin", "Duck", "Box", "Star"
];

const rooms = {
  plaza: {},
  lounge: {},
  rooftop: {}
};

function randomChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomName() {
  return `${randomChoice(WORDS_A)}${randomChoice(WORDS_B)}`;
}

function randomSpawn() {
  return {
    x: 120 + Math.random() * 500,
    y: 120 + Math.random() * 250
  };
}

function broadcastRoom(roomName) {
  const roomPlayers = rooms[roomName];
  const payload = JSON.stringify({
    type: "state",
    room: roomName,
    players: roomPlayers
  });

  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    if (client.room !== roomName) continue;
    client.send(payload);
  }
}

function removePlayer(ws) {
  if (!ws.playerId || !ws.room) return;
  if (rooms[ws.room] && rooms[ws.room][ws.playerId]) {
    delete rooms[ws.room][ws.playerId];
    broadcastRoom(ws.room);
  }
}

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2, 10);
  const spawn = randomSpawn();

  ws.playerId = id;
  ws.room = "plaza";

  rooms[ws.room][id] = {
    id,
    name: randomName(),
    x: spawn.x,
    y: spawn.y,
    targetX: spawn.x,
    targetY: spawn.y,
    emoji: null,
    emojiUntil: 0
  };

  ws.send(JSON.stringify({
    type: "welcome",
    id,
    room: ws.room,
    rooms: Object.keys(rooms)
  }));

  broadcastRoom(ws.room);

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const player = rooms[ws.room]?.[ws.playerId];
    if (!player) return;

    if (data.type === "move") {
      if (typeof data.x === "number" && typeof data.y === "number") {
        player.targetX = Math.max(20, Math.min(980, data.x));
        player.targetY = Math.max(20, Math.min(580, data.y));
      }
    }

    if (data.type === "emoji") {
      const allowed = ["😭","😀","😠","😕","👋","😎","❗","❓","❎","✅","👏"];
      if (allowed.includes(data.emoji)) {
        player.emoji = data.emoji;
        player.emojiUntil = Date.now() + 2200;
      }
    }

    if (data.type === "joinRoom") {
      const nextRoom = data.room;
      if (!rooms[nextRoom] || nextRoom === ws.room) return;

      const oldRoom = ws.room;
      const oldPlayer = rooms[oldRoom][ws.playerId];
      delete rooms[oldRoom][ws.playerId];

      const newSpawn = randomSpawn();
      ws.room = nextRoom;
      rooms[nextRoom][ws.playerId] = {
        ...oldPlayer,
        x: newSpawn.x,
        y: newSpawn.y,
        targetX: newSpawn.x,
        targetY: newSpawn.y,
        emoji: null,
        emojiUntil: 0
      };

      ws.send(JSON.stringify({
        type: "welcome",
        id: ws.playerId,
        room: ws.room,
        rooms: Object.keys(rooms)
      }));

      broadcastRoom(oldRoom);
      broadcastRoom(nextRoom);
    }
  });

  ws.on("close", () => {
    removePlayer(ws);
  });
});

setInterval(() => {
  for (const roomName of Object.keys(rooms)) {
    const room = rooms[roomName];

    for (const id of Object.keys(room)) {
      const p = room[id];

      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 1) {
        const step = 6;
        p.x += (dx / dist) * Math.min(step, dist);
        p.y += (dy / dist) * Math.min(step, dist);
      } else {
        p.x = p.targetX;
        p.y = p.targetY;
      }

      if (p.emoji && Date.now() > p.emojiUntil) {
        p.emoji = null;
        p.emojiUntil = 0;
      }
    }

    broadcastRoom(roomName);
  }
}, 1000 / 30);

console.log(`WebSocket server running on port ${PORT}`);

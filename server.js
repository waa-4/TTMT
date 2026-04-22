const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 3000 });

let players = {};

function randomName() {
  const a = ["Goat","Silly","Rusty","Crazy","Neon","Broken"];
  const b = ["Clown","Cube","Bean","Ghost","Wizard","Thing"];
  return a[Math.floor(Math.random()*a.length)] + b[Math.floor(Math.random()*b.length)];
}

wss.on("connection", ws => {
  const id = Math.random().toString(36).substr(2,9);

  players[id] = {
    x: 200,
    y: 200,
    name: randomName(),
    emoji: null
  };

  ws.on("message", msg => {
    let data = JSON.parse(msg);

    if (data.type === "move") {
      players[id].x = data.x;
      players[id].y = data.y;
    }

    if (data.type === "emoji") {
      players[id].emoji = data.emoji;
      setTimeout(() => players[id].emoji = null, 2000);
    }
  });

  ws.on("close", () => {
    delete players[id];
  });

  // send updates constantly
  setInterval(() => {
    ws.send(JSON.stringify(players));
  }, 50);
});

console.log("Server running on port 3000");

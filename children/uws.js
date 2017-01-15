const { Server: WebSocketServer } = require('uws');

const wss = new WebSocketServer({ port: process.env.UWEBSOCKET_PORT });
wss.on('connection', (ws) => {
  ws.on('message', payload => ws.send(JSON.stringify(JSON.parse(payload))));
});

process.send('go');

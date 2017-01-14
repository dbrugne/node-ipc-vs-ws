const WebSocketServer = require('websocket').server;
const http = require('http');

const server = http.createServer(() => {});
server.listen(process.env.WEBSOCKET_PORT, () => process.send('go'));

const wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false,
});

wsServer.on('request', (request) => {
  const connection = request.accept('echo-protocol', request.origin);
  connection.on(
    'message',
    message => connection.sendUTF(JSON.stringify(JSON.parse(message.utf8Data))),
  );
});

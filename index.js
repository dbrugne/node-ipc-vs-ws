/* eslint no-console:0 */
const { series } = require('async');
const Benchmark = require('benchmark');
const { fork } = require('child_process');
const { join } = require('path');
const { client: WebSocketClient } = require('websocket');

const WEBSOCKET_PORT = 8080;

const payload = {
  data1: 'string',
  data2: 10000000000000000000000000000000000000,
  data3: 100.500001,
  data4: [
    'item1',
    'item2',
    'item3',
  ],
  data5: {
    item1: 'item',
    item2: 'item',
    item3: 'item',
  },
};

const backpack = {
  ipc: {
    cb: () => {},
  },
  websocket: {
    cb: () => {},
    client: new WebSocketClient(),
    connection: null,
  },
};

function stop() {
  if (backpack.ipc && backpack.ipc.process) {
    backpack.ipc.process.kill();
  }
  if (backpack.websocket && backpack.websocket.process) {
    backpack.websocket.process.kill();
  }

  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('uncaughtException', stop);

series([
  // fork IPC process
  (callback) => {
    backpack.ipc.process = fork(join(__dirname, 'children/ipc.js'));
    backpack.ipc.process.on('message', () => {
      // after first message change message handler
      backpack.ipc.process.removeAllListeners('message');
      backpack.ipc.process.on('message', () => backpack.ipc.cb());
      callback(null);
    });
  },
  // fork ws server
  (callback) => {
    backpack.websocket.process = fork(
      join(__dirname, 'children/websocket.js'),
      { env: { WEBSOCKET_PORT } }
    );
    backpack.websocket.process.on('message', () => {
      backpack.websocket.client.on('connect', (connection) => {
        backpack.websocket.connection = connection;
        connection.on('message', (data) => {
          JSON.parse(data.utf8Data);
          backpack.websocket.cb();
        });
        callback(null);
      });

      backpack.websocket.client.connect(`ws://localhost:${WEBSOCKET_PORT}/`, 'echo-protocol');
    });
  },
  (callback) => {
    const suite = new Benchmark.Suite('IPC vs. Websocket');
    suite
      .add('IPC (complex)', {
        defer: true,
        fn: (deferred) => {
          backpack.ipc.cb = () => deferred.resolve();
          backpack.ipc.process.send(payload);
        },
      })
      .add('IPC (simple)', {
        defer: true,
        fn: (deferred) => {
          backpack.ipc.cb = () => deferred.resolve();
          backpack.ipc.process.send('string');
        },
      })
      .add('Websocket (complex)', {
        defer: true,
        fn: (deferred) => {
          backpack.websocket.cb = () => deferred.resolve();
          backpack.websocket.connection.sendUTF(JSON.stringify(payload));
        },
      })
      .add('Websocket (simple)', {
        defer: true,
        fn: (deferred) => {
          backpack.websocket.cb = () => deferred.resolve();
          backpack.websocket.connection.sendUTF(JSON.stringify('string'));
        },
      })
      .on('cycle', event => console.log(String(event.target)))
      .on('complete', () => {
        console.log(`${suite.name} : fastest is ${suite.filter('fastest').map('name')}`);
        callback(null);
      })
      .run({ async: false });
  },
], stop);

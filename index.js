/* eslint no-console:0 */
const { series } = require('async');
const Benchmark = require('benchmark');
const { fork } = require('child_process');
const { join } = require('path');
const { client: WebSocketClient } = require('websocket');
const UWebSocketClient = require('uws');

const WEBSOCKET_PORT = 8080;
const UWEBSOCKET_PORT = 8181;

const payloadComplex = {
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
  uws: {
    cb: () => {},
    client: null,
  },
};

function stop() {
  if (backpack.ipc.process) {
    backpack.ipc.process.kill();
  }
  if (backpack.websocket.process) {
    backpack.websocket.process.kill();
  }
  if (backpack.uws.process) {
    backpack.uws.process.kill();
  }

  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('uncaughtException', (e) => {
  console.error(e);
  stop();
});

series([
  // fork IPC process
  (callback) => {
    backpack.ipc.process = fork(join(__dirname, 'children/ipc.js'));
    backpack.ipc.process.on('message', () => {
      // after first message change message handler
      backpack.ipc.process.removeAllListeners('message');
      backpack.ipc.process.on('message', (data) => {
        if (data.data3 !== payloadComplex.data3) {
          throw new Error('type mismatch');
        }
        backpack.ipc.cb();
      });
      callback(null);
    });
  },
  // fork websocket server
  (callback) => {
    backpack.websocket.process = fork(
      join(__dirname, 'children/websocket.js'),
      { env: { WEBSOCKET_PORT } }
    );
    backpack.websocket.process.on('message', () => {
      backpack.websocket.client.on('connect', (connection) => {
        backpack.websocket.connection = connection;
        connection.on('message', (raw) => {
          const data = JSON.parse(raw.utf8Data);
          if (data.data3 !== payloadComplex.data3) {
            throw new Error('type mismatch');
          }
          backpack.websocket.cb();
        });
        callback(null);
      });

      backpack.websocket.client.connect(`ws://localhost:${WEBSOCKET_PORT}/`, 'echo-protocol');
    });
  },
  // fork uws server
  (callback) => {
    backpack.uws.process = fork(
      join(__dirname, 'children/uws.js'),
      { env: { UWEBSOCKET_PORT } }
    );
    backpack.uws.process.on('message', () => {
      backpack.uws.client = new UWebSocketClient(`ws://localhost:${UWEBSOCKET_PORT}`);
      backpack.uws.client.on('open', () => {
        backpack.uws.client.on('message', (raw) => {
          const data = JSON.parse(raw);
          if (data.data3 !== payloadComplex.data3) {
            throw new Error('type mismatch');
          }
          backpack.uws.cb();
        });
        callback(null);
      });
    });
  },
  (callback) => {
    console.log('= Complex message ===========================');
    const suite = new Benchmark.Suite('Complex message');
    suite
      .add('IPC', {
        defer: true,
        fn: (deferred) => {
          backpack.ipc.cb = () => deferred.resolve();
          backpack.ipc.process.send(payloadComplex);
        },
      })
      .add('Websocket', {
        defer: true,
        fn: (deferred) => {
          backpack.websocket.cb = () => deferred.resolve();
          backpack.websocket.connection.sendUTF(JSON.stringify(payloadComplex));
        },
      })
      .add('uWebsocket', {
        defer: true,
        fn: (deferred) => {
          backpack.uws.cb = () => deferred.resolve();
          backpack.uws.client.send(JSON.stringify(payloadComplex));
        },
      })
      .on('cycle', event => console.log(String(event.target)))
      .on('complete', () => {
        console.log(`${suite.name} : fastest is ${suite.filter('fastest').map('name')}`);
        console.log('=============================================');
        callback(null);
      })
      .run({ async: false, maxTime: 3, initCount: 5 });
  },
], stop);

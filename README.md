# node-ipc-vs-ws
An humble benchmark of Node.js native IPC vs. Websocket communication.

Compared communication channels are: 
* native [child_process](https://nodejs.org/api/child_process.html#child_process_child_process_fork_modulepath_args_options) IPC layer,
* [Websocket](https://github.com/theturtle32/WebSocket-Node) library 
* and the blazing fast as the light [uWebSockets](https://github.com/uWebSockets/uWebSockets) library.

Note that my use case requires complex object exchange between processes so JSON serialization/deserialization is operate manually with JSON.stringify|parse on Websocket and uWebsocket client and server side to have a real comparison with IPC that (de)serialize automatically. 

Result on Node.js 6.5.0:

```
IPC x 18,031 ops/sec ±2.44% (75 runs sampled)
Websocket x 8,200 ops/sec ±5.16% (78 runs sampled)
uWebsocket x 17,343 ops/sec ±3.67% (75 runs sampled)
Complex message : fastest are IPC,uWebsocket
```

Surprisingly uWebsockets is a little bit faster than IPC. 
I'm very interesting on knowing how they achieve to be faster than the native IPC API.

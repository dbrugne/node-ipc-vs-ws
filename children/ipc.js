process.send({});
process.on('message', payload => process.send(payload));

const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  const eventsPath = path.join(__dirname, '..', 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => {
        const result = event.execute(...args);
        if (result instanceof Promise) result.catch(console.error);
      });
    } else {
      client.on(event.name, (...args) => {
        const result = event.execute(...args);
        if (result instanceof Promise) result.catch(console.error);
      });
    }
  }
};

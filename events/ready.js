const commandHandler = require('../handlers/commandHandler');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ ${client.user.tag} is online!`);
    client.user.setActivity('Rosa Server Ticket', { type: 3 });

    const guild = client.guilds.cache.first();
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf-8'));
    const guildId = guild ? guild.id : config.guildId;

    if (guildId) await commandHandler(client, guildId);
  },
};

require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.commands = new Collection();

  const eventHandler = require('./handlers/eventHandler');

  eventHandler(client);

  client.login(process.env.TOKEN);
}

start();

setInterval(async () => {
  try {
    if (!client.isReady()) throw new Error('Not ready');
    await client.user.fetch();
  } catch {
    console.error('Bot unresponsive, restarting...');
    process.exit(1);
  }
}, 300000);

const RESTART_INTERVAL = 10 * 60 * 60 * 1000;
setTimeout(() => process.exit(0), RESTART_INTERVAL);

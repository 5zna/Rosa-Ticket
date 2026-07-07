const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const configMgr = require('../utils/configManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Post or repost the ticket panel'),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('Administrator')) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const config = configMgr.get();
    const panelChannel = interaction.guild.channels.cache.get(config.panelChannelId);
    if (!panelChannel) {
      return interaction.reply({ content: '❌ Panel channel not set. Use `/setup config` first.', ephemeral: true });
    }

    const p = config.panel || {};
    const menus = config.menus || {};
    const allOptions = [
      { label: p.inquiry?.label || 'Inquiry', description: p.inquiry?.description || 'General questions or support inquiries', value: 'Inquiry', emoji: p.inquiry?.emoji || '❓' },
      { label: p.staffApplication?.label || 'Staff Application', description: p.staffApplication?.description || 'Apply for a staff position', value: 'Staff Application', emoji: p.staffApplication?.emoji || '📝' },
    ];

    const selectMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket_menu')
        .setPlaceholder(p.placeholder || 'Choose an option...')
        .addOptions(allOptions.filter(o => menus[o.value] !== false)),
    );

    const msg = await panelChannel.send({ content: config.bannerUrl, components: [selectMenu] });
    config.panelMessageId = msg.id;
    configMgr.save(config);

    await interaction.reply({ content: `✅ Ticket panel posted in ${panelChannel}!`, ephemeral: true });
  },
};

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const configMgr = require('../utils/configManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('toggle')
    .setDescription('Enable or disable a ticket menu option'),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('Administrator')) {
      return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    }

    const config = configMgr.get();
    const p = config.panel || {};
    const menus = config.menus || {};

    const embed = new EmbedBuilder()
      .setTitle('Toggle Ticket Menus')
      .setDescription('Select a menu option to enable or disable it.')
      .setColor(0x5865f2)
      .addFields(
        { name: `${p.inquiry?.emoji || '❓'} ${p.inquiry?.label || 'Inquiry'}`, value: menus.Inquiry ? '✅ Enabled' : '❌ Disabled', inline: true },
        { name: `${p.staffApplication?.emoji || '📝'} ${p.staffApplication?.label || 'Staff Application'}`, value: menus['Staff Application'] ? '✅ Enabled' : '❌ Disabled', inline: true },
      );

    const selectMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('toggle_menu')
        .setPlaceholder('Select a menu to toggle...')
        .addOptions([
          { label: p.inquiry?.label || 'Inquiry', value: 'Inquiry', emoji: p.inquiry?.emoji || '❓', description: menus.Inquiry ? 'Currently enabled — click to disable' : 'Currently disabled — click to enable' },
          { label: p.staffApplication?.label || 'Staff Application', value: 'Staff Application', emoji: p.staffApplication?.emoji || '📝', description: menus['Staff Application'] ? 'Currently enabled — click to disable' : 'Currently disabled — click to enable' },
        ]),
    );

    await interaction.reply({ embeds: [embed], components: [selectMenu], ephemeral: true });
  },
};

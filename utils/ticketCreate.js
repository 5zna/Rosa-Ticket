const { ChannelType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const configMgr = require('./configManager');
const ticketStore = require('./ticketStore');
const blacklistStore = require('./blacklistStore');

module.exports = async (interaction, type, description) => {
  const config = configMgr.get();

  if (blacklistStore.isBlacklisted(interaction.user.id)) {
    return interaction.editReply({ content: '❌ You are blacklisted from creating tickets.' });
  }

  const ticketChannel = interaction.guild.channels.cache.get(config.ticketChannelId);
  if (!ticketChannel) return interaction.editReply({ content: '❌ Ticket channel not configured. Contact an admin.' });

  const threadName = `t-${interaction.user.username}`;
  const existingThread = ticketChannel.threads.cache.find(t => t.name === threadName);
  if (existingThread) {
    return interaction.editReply({ content: '❌ You already have an open ticket!' });
  }

  const thread = await ticketChannel.threads.create({
    name: threadName,
    type: ChannelType.PrivateThread,
    invitable: false,
  });

  await thread.members.add(interaction.user.id);

  const p = config.panel || {};
  const cat = type === 'Inquiry' ? p.inquiry : p.staffApplication;
  const catManagerRoles = cat?.managerRoles?.length ? cat.managerRoles : (config.managerRoles || []);
  const catSupportRoles = cat?.supportRoles?.length ? cat.supportRoles : (config.supportRoles || []);
  const catMentionRoles = cat?.mentionRoles?.length ? cat.mentionRoles : (config.mentionRoles || []);

  const addPromises = [];
  for (const roleId of catManagerRoles) {
    const role = interaction.guild.roles.cache.get(roleId);
    if (role) {
      for (const [, member] of role.members) {
        addPromises.push(thread.members.add(member.id).catch(() => {}));
      }
    }
  }
  await Promise.all(addPromises);

  const supportPings = catSupportRoles.map(id => `<@&${id}>`).join(' ');
  const mentionPings = catMentionRoles.map(id => `<@&${id}>`).join(' ');

  const btns = config.buttons || {};
  const b = (key, style) =>
    new ButtonBuilder()
      .setCustomId(key)
      .setLabel(btns[key]?.label || key)
      .setStyle(style)
      .setEmoji(btns[key]?.emoji || '🔘');

  const row = new ActionRowBuilder().addComponents(
    b('claim', ButtonStyle.Secondary),
    b('close', ButtonStyle.Secondary),
    b('delete', ButtonStyle.Secondary),
    b('add', ButtonStyle.Secondary),
    b('blacklist', ButtonStyle.Secondary),
  );

  await thread.send({ content: 'https://i.ibb.co/0jbsr3bK/Rosa-Server-Info.png' });
  const mentionMsg = await thread.send({ content: [mentionPings, supportPings, `<@${interaction.user.id}> \n يرجى طرح مشكلتك لحين تواجد الدعم`].filter(Boolean).join(' '), components: [row] });

  if (description) {
    const detailEmbed = new EmbedBuilder()
      .setTitle(`📝 ${type} Details`)
      .setColor(0x5865f2)
      .setFooter({ text: `Submitted by ${interaction.user.tag}` })
      .setTimestamp();

    if (Array.isArray(description)) {
      for (const f of description) {
        detailEmbed.addFields({ name: f.label, value: f.value || '*Not provided*', inline: false });
      }
    } else {
      detailEmbed.setDescription(description);
    }

    await thread.send({ embeds: [detailEmbed] });
  }

  const menus = config.menus || {};
  const allOptions = [
    { label: p.inquiry?.label || 'Inquiry', description: p.inquiry?.description || 'General questions or support inquiries', value: 'Inquiry', emoji: p.inquiry?.emoji || '❓' },
    { label: p.staffApplication?.label || 'Staff Application', description: p.staffApplication?.description || 'Apply for a staff position', value: 'Staff Application', emoji: p.staffApplication?.emoji || '📝' },
  ];
  const freshMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket_menu')
      .setPlaceholder(p.placeholder || 'Choose an option...')
      .addOptions(allOptions.filter(o => menus[o.value] !== false)),
  );

  if (interaction.message?.editable) {
    await interaction.message.edit({ components: [freshMenu] });
  }

  ticketStore.add({
    userId: interaction.user.id,
    threadId: thread.id,
    type,
    openedAt: new Date().toISOString(),
    guildId: interaction.guildId,
    mentionMessageId: mentionMsg.id,
  });

  await interaction.editReply({ content: `✅ Your ${type.toLowerCase()} ticket has been created: ${thread}` });
};

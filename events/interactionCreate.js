const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const createTicket = require('../utils/ticketCreate');
const configMgr = require('../utils/configManager');
const ticketStore = require('../utils/ticketStore');
const blacklistStore = require('../utils/blacklistStore');

const pendingMenuMessages = new Map();

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
      const config = configMgr.get();
      const menus = config.menus || {};
      const type = interaction.values[0];
      const p = config.panel || {};
      const cat = type === 'Inquiry' ? p.inquiry : p.staffApplication;

      if (menus[type] === false) {
        return interaction.reply({ content: `❌ **${type}** is currently disabled.`, ephemeral: true });
      }

      if (cat?.modal) {
        pendingMenuMessages.set(interaction.user.id, { channelId: interaction.channel.id, messageId: interaction.message.id });
        const modal = new ModalBuilder()
          .setCustomId(`ticket_modal_${type}`)
          .setTitle(cat.modal.title || type);

        if (cat.modal.fields) {
          for (const f of cat.modal.fields.slice(0, 5)) {
            modal.addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId(f.customId)
                  .setLabel(f.label)
                  .setStyle(f.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                  .setPlaceholder(f.placeholder || '')
                  .setRequired(f.required !== false)
                  .setMaxLength(f.maxLength || 4000),
              ),
            );
          }
        } else {
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('description')
                .setLabel(cat.modal.label || 'Details')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(cat.modal.placeholder || 'Write here...')
                .setRequired(cat.modal.required !== false),
            ),
          );
        }

        await interaction.showModal(modal);
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      await createTicket(interaction, type);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
      await interaction.deferReply({ ephemeral: true });
      const type = interaction.customId.replace('ticket_modal_', '');
      const config = configMgr.get();
      const cat = type === 'Inquiry' ? config.panel?.inquiry : config.panel?.staffApplication;
      let description;

      if (cat?.modal?.fields) {
        const fields = [];
        for (const f of cat.modal.fields) {
          fields.push({ label: f.label, value: interaction.fields.getTextInputValue(f.customId) });
        }
        description = fields;
      } else {
        description = interaction.fields.getTextInputValue('description');
      }

      await createTicket(interaction, type, description);

      const pending = pendingMenuMessages.get(interaction.user.id);
      if (pending) {
        pendingMenuMessages.delete(interaction.user.id);
        try {
          const channel = await interaction.client.channels.fetch(pending.channelId);
          const msg = await channel.messages.fetch(pending.messageId);
          const p = config.panel || {};
          const menus = config.menus || {};
          const freshMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('ticket_menu')
              .setPlaceholder(p.placeholder || 'Choose an option...')
              .addOptions([
                { label: p.inquiry?.label || 'Inquiry', description: p.inquiry?.description || 'General questions or support inquiries', value: 'Inquiry', emoji: p.inquiry?.emoji || '❓' },
                { label: p.staffApplication?.label || 'Staff Application', description: p.staffApplication?.description || 'Apply for a staff position', value: 'Staff Application', emoji: p.staffApplication?.emoji || '📝' },
              ].filter(o => menus[o.value] !== false)),
          );
          await msg.edit({ components: [freshMenu] });
        } catch {}
      }
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'toggle_menu') {
      const config = configMgr.get();
      const type = interaction.values[0];
      if (!config.menus) config.menus = {};
      config.menus[type] = !config.menus[type];
      configMgr.save(config);
      const status = config.menus[type] ? '✅ Enabled' : '❌ Disabled';
      await interaction.update({ content: `**${type}** is now ${status}`, embeds: [], components: [] });
      return;
    }

    if (interaction.isButton()) {
      const config = configMgr.get();
      try { interaction.member = await interaction.guild.members.fetch(interaction.user.id); } catch {}
      const memberRoles = interaction.member.roles.cache.map(r => r.id);
      const ticketInfo = ticketStore.getByThreadId(interaction.channel.id);
      const cat = ticketInfo ? (config.panel || {})[ticketInfo.type === 'Inquiry' ? 'inquiry' : 'staffApplication'] : null;
      const supportRoles = config.supportRoles || [];
      const managerRoles = config.managerRoles || [];
      const isSupport = supportRoles.some(r => memberRoles.includes(r));
      const isManager = managerRoles.some(r => memberRoles.includes(r));
      const isStaff = isSupport || isManager;

      if (interaction.customId === 'claim') {
        if (!isStaff) return interaction.reply({ content: '❌ Only support staff can claim tickets.', ephemeral: true });
        if (ticketInfo?.claimedBy) {
          return interaction.reply({ content: `⚠️ This ticket is already claimed by <@${ticketInfo.claimedBy}>.`, ephemeral: true });
        }
        await interaction.deferUpdate();
        const claimerId = interaction.user.id;
        const ownerId = ticketInfo?.userId;
        const removePromises = [];
        for (const [, tm] of await interaction.channel.members.fetch()) {
          if (tm.id === claimerId || tm.id === ownerId) continue;
          const guildMember = await interaction.guild.members.fetch(tm.id).catch(() => null);
          if (!guildMember) continue;
          const hasRole = [...supportRoles, ...managerRoles].some(r => guildMember.roles.cache.has(r));
          if (hasRole) {
            removePromises.push(interaction.channel.members.remove(tm.id).catch(() => {}));
          }
        }
        await Promise.all(removePromises);
        ticketStore.update(interaction.channel.id, { claimedBy: claimerId });
        const btns = config.buttons || {};
        const ub = (key, style) =>
          new ButtonBuilder()
            .setCustomId(key)
            .setLabel(btns[key]?.label || key)
            .setStyle(style)
            .setEmoji(btns[key]?.emoji || '🔘');
        await interaction.channel.send({
          content: `🙋 Ticket claimed by ${interaction.user}`,
          components: [new ActionRowBuilder().addComponents(ub('unclaim', ButtonStyle.Secondary))],
        });
        return;
      }

      if (interaction.customId === 'unclaim') {
        if (!ticketInfo?.claimedBy) return interaction.reply({ content: '❌ This ticket is not claimed.', ephemeral: true });
        if (ticketInfo.claimedBy !== interaction.user.id) return interaction.reply({ content: '❌ Only the claimer can unclaim.', ephemeral: true });
        await interaction.deferUpdate();
        ticketStore.update(interaction.channel.id, { claimedBy: null });
        const ownerId = ticketInfo?.userId;
        const addBackPromises = [];
        for (const [, tm] of await interaction.channel.members.fetch()) {
          if (tm.id === interaction.user.id || tm.id === ownerId) continue;
          const guildMember = await interaction.guild.members.fetch(tm.id).catch(() => null);
          if (!guildMember) continue;
          const hasRole = [...supportRoles, ...managerRoles].some(r => guildMember.roles.cache.has(r));
          if (!hasRole) {
            addBackPromises.push(interaction.channel.members.add(tm.id).catch(() => {}));
          }
        }
        for (const roleId of [...new Set([...supportRoles, ...managerRoles])]) {
          const role = interaction.guild.roles.cache.get(roleId);
          if (role) {
            for (const [, member] of role.members) {
              if (member.id !== interaction.user.id && member.id !== ownerId) {
                addBackPromises.push(interaction.channel.members.add(member.id).catch(() => {}));
              }
            }
          }
        }
        await Promise.all(addBackPromises);
        await interaction.message.edit({ components: [] });
        await interaction.channel.send({ content: `🔓 Ticket unclaimed by ${interaction.user}` });
        return;
      }

      if (interaction.customId === 'close') {
        if (!isStaff) return interaction.reply({ content: '❌ Only staff can close tickets.', ephemeral: true });
        const confirmEmbed = new EmbedBuilder()
          .setTitle('Close Ticket')
          .setDescription('Are you sure you want to close this ticket?')
          .setColor(0xe74c3c);
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('confirm_close').setLabel('Yes, close').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('cancel_action').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
        );
        await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true });
        return;
      }

      if (interaction.customId === 'delete') {
        if (!isManager) return interaction.reply({ content: '❌ Only managers can delete tickets.', ephemeral: true });
        const confirmEmbed = new EmbedBuilder()
          .setTitle('Delete Ticket')
          .setDescription('Are you sure you want to permanently delete this ticket?')
          .setColor(0xe74c3c);
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('confirm_delete').setLabel('Yes, delete').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('cancel_action').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
        );
        await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true });
        return;
      }

      if (interaction.customId === 'add') {
        if (!isManager) return interaction.reply({ content: '❌ Only managers can add users.', ephemeral: true });
        const modal = new ModalBuilder()
          .setCustomId('add_user_modal')
          .setTitle('Add User to Ticket')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('User ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Paste the user ID here')
                .setRequired(true),
            ),
          );
        await interaction.showModal(modal);
        return;
      }

      if (interaction.customId === 'blacklist') {
        if (!isManager) return interaction.reply({ content: '❌ Only managers can blacklist.', ephemeral: true });
        const ticketInfo = ticketStore.getByThreadId(interaction.channel.id);
        const userId = ticketInfo?.userId || interaction.channel.name.replace('t-', '');
        blacklistStore.add(userId);
        ticketStore.remove(interaction.channel.id);
        await interaction.channel.send({ content: `🚫 ${interaction.user} blacklisted the ticket creator. Closing ticket...` });
        setTimeout(async () => {
          try { await interaction.channel.delete(); } catch {}
        }, 2000);
        await interaction.deferUpdate();
        return;
      }

      if (interaction.customId === 'confirm_close') {
        await interaction.deferUpdate();
        const ticketInfo = ticketStore.getByThreadId(interaction.channel.id);
        if (ticketInfo) {
          await interaction.channel.members.remove(ticketInfo.userId);
          if (ticketInfo.mentionMessageId) {
            try { const m = await interaction.channel.messages.fetch(ticketInfo.mentionMessageId); await m.delete(); } catch {}
          }
          ticketStore.update(interaction.channel.id, { closed: true });
          const btns = config.buttons || {};
          const b = (key, style) =>
            new ButtonBuilder()
              .setCustomId(key)
              .setLabel(btns[key]?.label || key)
              .setStyle(style)
              .setEmoji(btns[key]?.emoji || '🔘');
          const reopenRow = new ActionRowBuilder().addComponents(
            b('claim', ButtonStyle.Secondary),
            b('reopen', ButtonStyle.Secondary),
            b('delete', ButtonStyle.Secondary),
            b('add', ButtonStyle.Secondary),
            b('blacklist', ButtonStyle.Secondary),
          );
          await interaction.channel.send({ content: `🔒 Ticket closed by <@${interaction.user.id}>`, components: [reopenRow] });
        }
        return;
      }

      if (interaction.customId === 'reopen') {
        await interaction.deferUpdate();
        const ticketInfo = ticketStore.getByThreadId(interaction.channel.id);
        if (!ticketInfo) return interaction.followUp({ content: '❌ Ticket data not found.', ephemeral: true });
        await interaction.channel.members.add(ticketInfo.userId);
        ticketStore.update(interaction.channel.id, { closed: false });
        const btns = config.buttons || {};
        const b = (key, style) =>
          new ButtonBuilder()
            .setCustomId(key)
            .setLabel(btns[key]?.label || key)
            .setStyle(style)
            .setEmoji(btns[key]?.emoji || '🔘');
        const closeRow = new ActionRowBuilder().addComponents(
          b('claim', ButtonStyle.Secondary),
          b('close', ButtonStyle.Secondary),
          b('delete', ButtonStyle.Secondary),
          b('add', ButtonStyle.Secondary),
          b('blacklist', ButtonStyle.Secondary),
        );
        const reopenMsg = interaction.message;
        await reopenMsg.edit({ content: `🔓 Ticket reopened by <@${interaction.user.id}>`, components: [closeRow] });
        return;
      }

      if (interaction.customId === 'confirm_delete') {
        await interaction.deferUpdate();
        ticketStore.remove(interaction.channel.id);
        await interaction.channel.delete();
        return;
      }

      if (interaction.customId === 'cancel_action') {
        await interaction.update({ content: 'Cancelled.', embeds: [], components: [] });
        return;
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'add_user_modal') {
      const userId = interaction.fields.getTextInputValue('user_id');
      try {
        await interaction.channel.members.add(userId);
        await interaction.reply({ content: `✅ Added <@${userId}> to the ticket.`, ephemeral: true });
      } catch {
        await interaction.reply({ content: '❌ Invalid user ID or user not found.', ephemeral: true });
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: '❌ There was an error executing that command.', ephemeral: true });
      }
    }
  },
};

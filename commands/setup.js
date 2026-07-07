const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const configMgr = require('../utils/configManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the ticket system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup(group =>
      group
        .setName('role')
        .setDescription('Manage ticket roles')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Add a role to a ticket category')
            .addStringOption(opt =>
              opt.setName('type').setDescription('Role type').setRequired(true)
                .addChoices(
                  { name: 'Support', value: 'support' },
                  { name: 'Mention', value: 'mention' },
                  { name: 'Manager', value: 'manager' },
                ))
            .addRoleOption(opt =>
              opt.setName('role').setDescription('Select a role').setRequired(true)),
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Remove a role from a ticket category')
            .addStringOption(opt =>
              opt.setName('type').setDescription('Role type').setRequired(true)
                .addChoices(
                  { name: 'Support', value: 'support' },
                  { name: 'Mention', value: 'mention' },
                  { name: 'Manager', value: 'manager' },
                ))
            .addRoleOption(opt =>
              opt.setName('role').setDescription('Select a role').setRequired(true)),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('config')
        .setDescription('Set the panel and ticket channels')
        .addChannelOption(opt =>
          opt.setName('panel-channel').setDescription('Channel for the ticket panel').setRequired(true))
        .addChannelOption(opt =>
          opt.setName('ticket-channel').setDescription('Channel where ticket threads open').setRequired(true))
        .addStringOption(opt =>
          opt.setName('banner-url').setDescription('Custom banner image URL').setRequired(false)),
    )
    .addSubcommand(sub =>
      sub
        .setName('emoji')
        .setDescription('Set a custom emoji')
        .addStringOption(opt =>
          opt.setName('key').setDescription('Which emoji to change').setRequired(true)
            .addChoices(
              { name: 'Inquiry menu', value: 'inquiry' },
              { name: 'Staff Application menu', value: 'staffApplication' },
              { name: 'Panel title', value: 'panelTitle' },
            ))
        .addStringOption(opt =>
          opt.setName('emoji').setDescription('The emoji to use').setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName('button')
        .setDescription('Customize a ticket button')
        .addStringOption(opt =>
          opt.setName('key').setDescription('Which button').setRequired(true)
            .addChoices(
              { name: 'Close', value: 'close' },
              { name: 'Delete', value: 'delete' },
              { name: 'Claim', value: 'claim' },
              { name: 'Add', value: 'add' },
              { name: 'Blacklist', value: 'blacklist' },
            ))
        .addStringOption(opt =>
          opt.setName('label').setDescription('Button label text').setRequired(true))
        .addStringOption(opt =>
          opt.setName('emoji').setDescription('Button emoji').setRequired(false)),
    )
    .addSubcommandGroup(group =>
      group
        .setName('blacklist')
        .setDescription('Manage blacklisted users')
        .addSubcommand(sub =>
          sub.setName('add').setDescription('Blacklist a user')
            .addUserOption(opt => opt.setName('user').setDescription('Select a user').setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('remove').setDescription('Unblacklist a user')
            .addStringOption(opt => opt.setName('user-id').setDescription('User ID to remove').setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('list').setDescription('View all blacklisted users')),
    )
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Post or update the ticket panel'),
    )
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View current ticket configuration'),
    ),
  async execute(interaction) {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ Only the guild owner can use this command.', ephemeral: true });
    }

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    const config = configMgr.get();

    if (subcommandGroup === 'role') {
      const type = interaction.options.getString('type');
      const role = interaction.options.getRole('role');

      if (subcommand === 'add') {
        const key = `${type}Roles`;
        if (!config[key]) config[key] = [];
        if (config[key].includes(role.id)) {
          return interaction.reply({ content: `❌ ${role} is already a ${type} role.`, ephemeral: true });
        }
        config[key].push(role.id);
        configMgr.save(config);
        return interaction.reply({ content: `✅ Added ${role} as a **${type}** role.`, ephemeral: true });
      }

      if (subcommand === 'remove') {
        const key = `${type}Roles`;
        if (!config[key]) config[key] = [];
        if (!config[key].includes(role.id)) {
          return interaction.reply({ content: `❌ ${role} is not in the ${type} roles list.`, ephemeral: true });
        }
        config[key] = config[key].filter(id => id !== role.id);
        configMgr.save(config);
        return interaction.reply({ content: `✅ Removed ${role} from **${type}** roles.`, ephemeral: true });
      }
    }

    if (subcommandGroup === 'blacklist') {
      const blacklistStore = require('../utils/blacklistStore');
      if (subcommand === 'add') {
        const user = interaction.options.getUser('user');
        blacklistStore.add(user.id);
        return interaction.reply({ content: `✅ Blacklisted ${user}.`, ephemeral: true });
      }
      if (subcommand === 'remove') {
        const userId = interaction.options.getString('user-id');
        blacklistStore.remove(userId);
        return interaction.reply({ content: `✅ Removed \`${userId}\` from blacklist.`, ephemeral: true });
      }
      if (subcommand === 'list') {
        const list = blacklistStore.getAll();
        if (!list.length) return interaction.reply({ content: 'No blacklisted users.', ephemeral: true });
        const users = list.map(id => `<@${id}>`).join(', ');
        return interaction.reply({ content: `**Blacklisted users:** ${users}`, ephemeral: true });
      }
    }

    if (subcommand === 'config') {
      const panelChannel = interaction.options.getChannel('panel-channel');
      const ticketChannel = interaction.options.getChannel('ticket-channel');
      const bannerUrl = interaction.options.getString('banner-url');

      config.panelChannelId = panelChannel.id;
      config.ticketChannelId = ticketChannel.id;
      if (bannerUrl) config.bannerUrl = bannerUrl;
      configMgr.save(config);

      return interaction.reply({
        content: `✅ Channels configured!\nPanel: ${panelChannel}\nTickets: ${ticketChannel}`,
        ephemeral: true,
      });
    }

    if (subcommand === 'emoji') {
      const key = interaction.options.getString('key');
      const emoji = interaction.options.getString('emoji');
      if (!config.emojis) config.emojis = {};
      config.emojis[key] = emoji;
      configMgr.save(config);
      return interaction.reply({ content: `✅ Emoji for **${key}** set to ${emoji}`, ephemeral: true });
    }

    if (subcommand === 'button') {
      const key = interaction.options.getString('key');
      const label = interaction.options.getString('label');
      const emoji = interaction.options.getString('emoji');
      if (!config.buttons) config.buttons = {};
      if (!config.buttons[key]) config.buttons[key] = {};
      config.buttons[key].label = label;
      if (emoji) config.buttons[key].emoji = emoji;
      configMgr.save(config);
      return interaction.reply({ content: `✅ Button **${key}** updated: "${label}" ${emoji || ''}`, ephemeral: true });
    }

    if (subcommand === 'panel') {
      const panelChannel = interaction.guild.channels.cache.get(config.panelChannelId);
      if (!panelChannel) {
        return interaction.reply({ content: '❌ Panel channel not set. Run `/setup config` first.', ephemeral: true });
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

      return interaction.reply({ content: `✅ Panel posted in ${panelChannel}!`, ephemeral: true });
    }

    if (subcommand === 'view') {
      const embed = new EmbedBuilder()
        .setTitle('📋 Ticket System Configuration')
        .setColor(0x2ecc71)
        .addFields(
          { name: 'Panel Channel', value: config.panelChannelId ? `<#${config.panelChannelId}>` : 'Not set', inline: true },
          { name: 'Ticket Channel', value: config.ticketChannelId ? `<#${config.ticketChannelId}>` : 'Not set', inline: true },
          { name: 'Support Roles', value: config.supportRoles?.length ? config.supportRoles.map(id => `<@&${id}>`).join(', ') : 'None', inline: false },
          { name: 'Mention Roles', value: config.mentionRoles?.length ? config.mentionRoles.map(id => `<@&${id}>`).join(', ') : 'None', inline: false },
          { name: 'Manager Roles', value: config.managerRoles?.length ? config.managerRoles.map(id => `<@&${id}>`).join(', ') : 'None', inline: false },
          { name: 'Panel Message ID', value: config.panelMessageId || 'Not posted yet', inline: false },
          { name: 'Panel', value: `Placeholder: "${config.panel?.placeholder || '...'}"\nInquiry: ${config.panel?.inquiry?.emoji || '❓'} ${config.panel?.inquiry?.label || 'Inquiry'}\nStaff App: ${config.panel?.staffApplication?.emoji || '📝'} ${config.panel?.staffApplication?.label || 'Staff Application'}`, inline: false },
          { name: 'Global Roles', value: `Support: ${(config.supportRoles || []).map(id => `<@&${id}>`).join(', ') || 'None'}\nManager: ${(config.managerRoles || []).map(id => `<@&${id}>`).join(', ') || 'None'}\nMention: ${(config.mentionRoles || []).map(id => `<@&${id}>`).join(', ') || 'None'}`, inline: false },
          { name: 'Buttons', value: Object.entries(config.buttons || {}).map(([k, v]) => `**${k}**: ${v.emoji || ''} ${v.label}`).join('\n') || 'Default', inline: false },
          { name: 'Menus', value: Object.entries(config.menus || {}).map(([k, v]) => `${v ? '✅' : '❌'} **${k}**`).join('\n') || 'Default', inline: false },
        )
        .setFooter({ text: 'Banner URL: ' + (config.bannerUrl || 'default') });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

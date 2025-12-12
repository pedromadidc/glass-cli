/**
 * Help Command
 * 
 * Display help information about available commands.
 * Uses the unified Glass results page for consistent styling.
 * 
 * Usage: help [command]
 * Example: help
 * Example: help list
 */

(function() {
  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const command = {
    name: 'help',
    aliases: ['h', '?'],
    description: 'Show help information',
    usage: 'help [command]',
    examples: [
      'help           - Show all available commands',
      'help list      - Show help for the list command',
      'help impersonate - Show help for the impersonate command'
    ],

    /**
     * Execute the help command
     * @param {Array<string>} args - Command arguments
     * @param {Object} ctx - Execution context
     */
    async execute(args, ctx) {
      const registry = window.GlassCommandRegistry;
      const resultsPage = window.GlassResultsPage;

      if (args.length > 0) {
        // Show help for specific command
        const cmdName = args[0].toLowerCase();
        const cmd = registry.get(cmdName);

        if (!cmd) {
          const { ui } = ctx;
          ui.showError(`Unknown command: ${cmdName}`);
          return;
        }

        // Build command details content
        let content = '';

        // Command info section
        content += resultsPage.buildSection('Command Details', `
          <div class="glass-card">
            <div class="glass-card-title">${escapeHtml(cmd.name)}</div>
            <div class="glass-card-subtitle">${escapeHtml(cmd.description)}</div>
            <div class="glass-card-meta">Usage: <span class="glass-code">${escapeHtml(cmd.usage)}</span></div>
          </div>
        `);

        // Aliases section
        if (cmd.aliases && cmd.aliases.length > 0) {
          content += resultsPage.buildSection('Aliases', `
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${cmd.aliases.map(a => `<span class="glass-code">${escapeHtml(a)}</span>`).join('')}
            </div>
          `);
        }

        // Examples section
        if (cmd.examples && cmd.examples.length > 0) {
          const exampleCards = cmd.examples.map(ex => {
            const parts = ex.split(' - ');
            return {
              title: escapeHtml(parts[0] || ex),
              subtitle: escapeHtml(parts[1] || '')
            };
          });
          content += resultsPage.buildSection('Examples', 
            exampleCards.map(e => resultsPage.buildCard(e)).join('')
          );
        }

        const html = resultsPage.buildPage({
          title: `Command: ${escapeHtml(cmd.name)}`,
          subtitle: escapeHtml(cmd.description),
          content: content
        });

        resultsPage.openPage(html);

      } else {
        // Show all commands
        const commands = registry.getAll();

        // Build stats
        const statsHtml = resultsPage.buildStats([
          { value: commands.length, label: 'Commands' },
          { value: commands.reduce((acc, cmd) => acc + (cmd.aliases?.length || 0), 0), label: 'Aliases' }
        ]);

        // Build command cards
        const commandCards = commands.map(cmd => ({
          title: escapeHtml(cmd.name),
          subtitle: escapeHtml(cmd.description),
          meta: `Usage: ${escapeHtml(cmd.usage)}`,
          badge: cmd.aliases && cmd.aliases.length > 0 ? escapeHtml(cmd.aliases.join(', ')) : ''
        }));

        const content = statsHtml + resultsPage.buildSection('Available Commands', 
          resultsPage.buildCardGrid(commandCards)
        );

        // Tips section
        const tipsContent = `
          <div class="glass-card">
            <div class="glass-card-title">Quick Tips</div>
            <div class="glass-card-subtitle">
              • Use <span class="glass-code">Tab</span> for auto-completion<br>
              • Use <span class="glass-code">↑/↓</span> arrows for command history<br>
              • Press <span class="glass-code">Escape</span> to close the CLI<br>
              • Type <span class="glass-code">help &lt;command&gt;</span> for detailed help
            </div>
          </div>
        `;

        const fullContent = content + resultsPage.buildSection('Tips', tipsContent);

        const html = resultsPage.buildPage({
          title: 'Glass CLI',
          subtitle: 'Development Tool',
          content: fullContent
        });

        resultsPage.openPage(html);
      }

      ctx.ui.hide();
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();


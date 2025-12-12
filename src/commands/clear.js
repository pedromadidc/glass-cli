/**
 * Clear Command
 * 
 * Clear the command history.
 * 
 * Usage: clear
 */

(function() {
  const command = {
    name: 'clear',
    aliases: ['cls'],
    description: 'Clear command history',
    usage: 'clear',
    examples: [
      'clear - Clear the command history'
    ],

    /**
     * Execute the clear command
     * @param {Array<string>} args - Command arguments
     * @param {Object} ctx - Execution context
     */
    async execute(args, ctx) {
      const { ui } = ctx;
      ui.clearHistory();
      ui.showInfo('Command history cleared.');
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();


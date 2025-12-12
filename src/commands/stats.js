/**
 * Stats Command
 *
 * Navigate to the statistics page.
 *
 * Usage: stats
 * Example: stats
 */

(function() {
  const command = {
    name: 'stats',
    aliases: ['statistics', 'performance'],
    description: 'Open statistics/performance page',
    usage: 'stats',
    examples: [
      'stats - Open the platform statistics interface'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      // No arguments needed
      return true;
    },

    /**
     * Execute the stats command
     */
    async execute(args, ctx) {
      const { ui, context } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      const statsUrl = `${instanceUrl}/stats.do`;

      ui.showSuccess('Opening statistics...');
      ui.hide();

      window.location.href = statsUrl;
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();

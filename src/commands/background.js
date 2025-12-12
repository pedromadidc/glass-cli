/**
 * Background Command
 *
 * Navigate to the background scripts page.
 *
 * Usage: background
 * Example: background
 */

(function() {
  const command = {
    name: 'background',
    aliases: ['bg', 'scripts'],
    description: 'Open background scripts page',
    usage: 'background',
    examples: [
      'background - Open the background scripts interface'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      // No arguments needed
      return true;
    },

    /**
     * Execute the background command
     */
    async execute(args, ctx) {
      const { ui, context } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      const backgroundUrl = `${instanceUrl}/now/nav/ui/classic/params/target/sys.scripts.modern.do`;

      ui.showSuccess('Opening background scripts...');
      ui.hide();

      window.location.href = backgroundUrl;
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();

/**
 * Cancel My Transaction Command
 *
 * Cancel the current user's transaction by making a background GET request to /cancel_my_transaction.do
 * No navigation - just cancels the transaction silently.
 *
 * Usage: cancel my transaction
 * Short: cmt
 */

(function() {
  const command = {
    name: 'cancelmytransaction',
    aliases: ['cancel', 'canceltransaction'],
    description: 'Cancel the current user transaction',
    usage: 'cancel my transaction',
    examples: [
      'cmt                      - Cancel current transaction',
      'cancel my transaction    - Same as cmt'
    ],

    validate(args) {
      // No arguments needed
      return true;
    },

    async execute(args, ctx) {
      const { ui, context } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      try {
        ui.showInfo('Cancelling current transaction...');

        // Make background GET request to /cancel_my_transaction.do
        const transactionUrl = `${instanceUrl}/cancel_my_transaction.do`;

        // Use fetch to make the request without leaving the page
        const response = await fetch(transactionUrl, {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cache-Control': 'no-cache'
          }
        });

        if (response.ok) {
          ui.showSuccess('Current transaction cancelled successfully!');
        } else {
          // Even if not 200, the request might have triggered cancellation
          ui.showSuccess('Transaction cancellation request sent');
        }

      } catch (error) {
        ui.showError(`Failed to cancel transaction: ${error.message}`);
      }
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();


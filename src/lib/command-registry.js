/**
 * Command Registry - Extensible command registration and execution system
 * 
 * Commands are registered with:
 * - name: Primary command name
 * - aliases: Alternative names (e.g., 'imp' for 'impersonate')
 * - description: Short description for help
 * - usage: Usage string with arguments
 * - execute(args, context): Async function to run the command
 * - validate(args): Optional validation function
 */

class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.aliases = new Map();
  }

  /**
   * Register a command
   * @param {Object} command - Command definition object
   */
  register(command) {
    if (!command.name || !command.execute) {
      throw new Error('Command must have a name and execute function');
    }

    // Store the command
    this.commands.set(command.name.toLowerCase(), command);

    // Register aliases
    if (command.aliases && Array.isArray(command.aliases)) {
      command.aliases.forEach(alias => {
        this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
      });
    }
  }

  /**
   * Get a command by name or alias
   * @param {string} name - Command name or alias
   * @returns {Object|null} - Command object or null
   */
  get(name) {
    const normalizedName = name.toLowerCase();
    
    // Check direct command
    if (this.commands.has(normalizedName)) {
      return this.commands.get(normalizedName);
    }

    // Check aliases
    if (this.aliases.has(normalizedName)) {
      const realName = this.aliases.get(normalizedName);
      return this.commands.get(realName);
    }

    return null;
  }

  /**
   * Execute a command
   * @param {string} commandLine - Full command line string
   * @param {Object} context - Execution context (instanceUrl, ui, api, etc.)
   * @returns {Promise<void>}
   */
  async execute(commandLine, context) {
    const parts = commandLine.trim().split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);

    const command = this.get(commandName);

    if (!command) {
      throw new Error(`Unknown command: ${commandName}. Type 'help' for available commands.`);
    }

    // Validate arguments if validator exists
    if (command.validate) {
      const validationResult = command.validate(args);
      if (validationResult !== true) {
        throw new Error(validationResult || `Invalid arguments for ${command.name}`);
      }
    }

    // Execute the command
    await command.execute(args, context);
  }

  /**
   * Get all registered commands
   * @returns {Array} - Array of command objects
   */
  getAll() {
    return Array.from(this.commands.values());
  }

  /**
   * Get command names for auto-completion
   * @returns {Array<string>} - Array of command names
   */
  getCommandNames() {
    const names = Array.from(this.commands.keys());
    const aliasNames = Array.from(this.aliases.keys());
    return [...new Set([...names, ...aliasNames])];
  }

  /**
   * Find commands matching a prefix (for auto-suggestion)
   * @param {string} prefix - Prefix to match
   * @returns {Array<string>} - Matching command names
   */
  findMatching(prefix) {
    const normalizedPrefix = prefix.toLowerCase();
    return this.getCommandNames().filter(name => 
      name.startsWith(normalizedPrefix)
    );
  }
}

// Export singleton instance
window.GlassCommandRegistry = window.GlassCommandRegistry || new CommandRegistry();


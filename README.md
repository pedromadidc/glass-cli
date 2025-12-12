# Glass - Platform CLI Extension

A powerful command-line interface Chrome extension for platform development. Features a beautiful glass sphere floating icon that expands into a CLI overlay for quick navigation, user impersonation, ACL checking, and more.

**Version 3.0** - Complete architecture rewrite with 30+ commands.

## Disclaimer

**THIS IS NOT AN OFFICIAL SERVICENOW PRODUCT.** This extension is an independent, community-developed tool and is not affiliated with, endorsed by, sponsored by, or in any way officially connected with ServiceNow, Inc.

ServiceNow is a registered trademark of ServiceNow, Inc. All product and company names are trademarks or registered trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.

**NO WARRANTY:** This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement.

**LIMITATION OF LIABILITY:** In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.

**USE AT YOUR OWN RISK.** By using this extension, you acknowledge that you understand these terms and accept full responsibility for any consequences of its use.

## Features

- Beautiful glass sphere floating icon with depth effects
- Customizable keyboard shortcut (default: `Ctrl+Shift+G`)
- Smart auto-complete for commands and table names
- Command history navigation (Up/Down arrows)
- Uses existing browser session - no additional login required
- Modular command system - easy to extend
- Results displayed in beautiful glass-styled pages

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. Navigate to any supported instance

## Usage

Press `Ctrl+Shift+G` (or your configured shortcut) on any supported page, or click the floating glass sphere to open the CLI.

### Available Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `acl <user> <table> [record] [field]` | `security`, `permissions` | Check ACL permissions for a user |
| `background` | `bg`, `scripts` | Open background scripts page |
| `cache` | `flush`, `clearcache` | Clear platform caches |
| `clear` | `cls` | Clear command history |
| `cmt` | `cancel`, `canceltransaction` | Cancel the current user transaction |
| `code <term>` | `script` | Search script-capable fields |
| `config <table>` | `personalize`, `configure` | Open table configuration |
| `do <table>` | `new`, `create` | Open a new record form |
| `explode` | `ex`, `reveal`, `tn` | Show technical names for fields |
| `filter <table>` | `f`, `query` | Open table list with filter panel |
| `help [command]` | `h`, `?` | Show help information |
| `home` | - | Navigate to instance home page |
| `impersonate <user>` | `imp`, `su` | Impersonate a user by username |
| `keyword <term>` | `k`, `kw`, `search` | Search all text-indexed tables |
| `list <table>` | `ls`, `l` | Navigate to a table list view |
| `login` | `signin`, `li` | Navigate to login page |
| `logout` | `signout`, `lo`, `bye` | Navigate to logout page |
| `me` | `myprofile`, `profile` | View your own user record |
| `mirror <source> apply <target>` | `mirroraccess`, `cloneaccess` | Mirror roles/groups between users |
| `online` | `who`, `active` | Show currently online users |
| `play` | `ball`, `bounce`, `fun` | Turn the icon into a bouncy ball! |
| `pop` | `classic`, `switch` | Switch to classic UI view |
| `postman` | `pm`, `collection` | Generate Postman collection |
| `random <table>` | `rand`, `r` | Open a random record from a table |
| `record <table> <id>` | `open`, `goto` | Open a record by sys_id or number |
| `retrievesets <source>` | `retrieve`, `rs` | Retrieve update sets from remote |
| `separate <user>` | `lockout`, `terminate` | Lock out a user and strip roles |
| `stats` | `statistics`, `performance` | Open statistics page |
| `upload <table>` | `import`, `load` | Open XML import page |
| `xml` | `export`, `unload` | Export current record to XML |

### Examples

```
list incident          # Go to incident list
do change              # Create new change request
impersonate admin      # Impersonate the admin user
random incident        # Open a random incident
acl admin incident     # Check ACLs for admin on incident table
keyword RITM0284161    # Search for a term across all tables
retrievesets DEV       # Retrieve update sets from DEV source
help acl               # Get help for acl command
```

## Architecture

Glass uses a modular architecture designed for extensibility:

```
glass/
├── manifest.json              # Extension configuration
├── popup.html/js              # Settings popup (shortcut config)
├── api-bridge.js              # Page context API bridge
├── src/
│   ├── lib/
│   │   ├── command-registry.js  # Command registration & execution
│   │   ├── context.js           # Shared state (instance URL, storage)
│   │   ├── api.js               # API service layer
│   │   ├── ui.js                # CLI overlay UI components
│   │   ├── background-script.js # Background script runner
│   │   └── results-page.js      # Glass-styled results pages
│   ├── commands/              # 30+ command implementations
│   ├── floating-icon.js       # Glass sphere UI
│   └── main.js                # Entry point & initialization
└── icons/
    └── icon.svg
```

### Key Components

- **Command Registry** (`GlassCommandRegistry`): Manages command registration and execution
- **API Service** (`GlassAPI`): Handles authenticated API calls
- **Context** (`GlassContext`): Provides instance detection and storage
- **Background Script** (`GlassBackgroundScript`): Executes server-side scripts
- **Results Page** (`GlassResultsPage`): Builds beautiful glass-styled output pages

## Adding New Commands

Create a file in `src/commands/`:

```javascript
(function() {
  const command = {
    name: 'mycommand',
    aliases: ['mc'],
    description: 'Description of my command',
    usage: 'mycommand <arg>',
    examples: [
      'mycommand foo - Does something with foo'
    ],

    validate(args) {
      if (args.length === 0) {
        return 'Usage: mycommand <arg>';
      }
      return true;
    },

    async execute(args, ctx) {
      const { ui, api, context } = ctx;
      
      const instanceUrl = await context.getInstanceUrl();
      
      // Make API calls
      const result = await api.tableGet(instanceUrl, 'incident', {
        query: 'active=true',
        limit: 10
      });
      
      ui.showSuccess('Command completed!');
      
      // Navigate if needed
      window.location.href = `${instanceUrl}/some_page.do`;
    }
  };

  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
```

Then add it to `manifest.json` in the `content_scripts` array before `main.js`.

## Configuration

Click the Glass extension icon in Chrome to:
- Configure the keyboard shortcut
- Access social links

## API Reference

### GlassAPI

```javascript
// Table API - GET records
const users = await api.tableGet(instanceUrl, 'sys_user', {
  query: 'active=true',
  fields: ['sys_id', 'user_name', 'name'],
  limit: 100
});

// Lookup user by username
const user = await api.lookupUser(instanceUrl, 'admin');

// Impersonate a user
await api.impersonate(instanceUrl, 'john.doe');

// Get current user
const currentUser = await api.getCurrentUser(instanceUrl);
```

### GlassBackgroundScript

```javascript
// Execute a background script
const html = await window.GlassBackgroundScript.execute(script, { instanceUrl });

// Execute and parse JSON results
const results = await window.GlassBackgroundScript.executeAndParse(
  script,
  '###RESULTS###',
  '###END###',
  { instanceUrl }
);
```

### GlassResultsPage

```javascript
// Build a results page
const content = window.GlassResultsPage.buildStats([
  { value: '42', label: 'Total' }
]);

const html = window.GlassResultsPage.buildPage({
  title: 'My Results',
  subtitle: 'Description',
  content: content
});

window.GlassResultsPage.openPage(html);
```

## Troubleshooting

### CLI not appearing
- Ensure you're on a supported page (*.servicenow.com or *.service-now.com)
- Check that the shortcut isn't conflicting with another extension
- Try clicking the floating glass sphere directly

### API calls failing
- Make sure you're logged into the platform
- Check the browser console (F12) for error messages
- Verify you have permissions for the operation

### Commands returning empty results
- Check if you have read access to the table
- Try running the command with different parameters
- Check browser console for detailed error messages

## Development

### Testing

1. Load the extension in Chrome
2. Navigate to a supported instance
3. Press `Ctrl+Shift+G` or click the glass sphere
4. Test commands and verify functionality

## Authors

- **Pedro Madi** - [LinkedIn](https://www.linkedin.com/in/pedromadi/)
- **Caio Coletta** - [LinkedIn](https://www.linkedin.com/in/colettacaio/)

## License

Licensed under the MIT License.

# Passbolt MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server for [Passbolt](https://www.passbolt.com/) — the open-source password manager. Enables AI assistants (Claude Desktop, OpenCode, etc.) to securely interact with your Passbolt vault.

> **Security notice:** This server decrypts passwords locally using your private GPG key and passes them to the AI context. Only use it with trusted AI providers and on secured machines. Never expose `PASSBOLT_PRIVATE_KEY` or `PASSBOLT_PASSPHRASE` in logs or version control.

## Features

- **Resources** — list, get (with decryption), create, update, delete passwords; generate secure passwords
- **Folders** — list, create, rename, delete folders; move resources between folders
- **Sharing** — list users/groups, share resources with permission levels (Read/Update/Owner), inspect permissions

## Requirements

- Node.js 20+
- A running Passbolt CE/Pro instance with JWT auth enabled
- A Passbolt user account with a GPG key

## Installation

```bash
npm install -g passbolt-mcp-server
```

Or run directly with npx:

```bash
npx passbolt-mcp-server
```

## Configuration

Set the following environment variables:

| Variable | Required | Description |
|---|---|---|
| `PASSBOLT_BASE_URL` | Yes | Your Passbolt instance URL (e.g. `https://passbolt.example.com`) |
| `PASSBOLT_USER_ID` | Yes | Your Passbolt user UUID |
| `PASSBOLT_PRIVATE_KEY` | Yes | ASCII-armored GPG private key (newlines as `\n` or actual newlines) |
| `PASSBOLT_PASSPHRASE` | No | Passphrase for the private key (if protected) |
| `PASSBOLT_RESOURCE_TYPE_ID` | No | Override the default password resource type UUID |

### Getting your User ID

Log in to Passbolt, go to **Profile → Account** — your User ID is shown in the URL or profile page.

### Getting your Private Key

```bash
# Export your GPG private key
gpg --armor --export-secret-keys your-passbolt-email@example.com
```

## Claude Desktop Configuration

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "passbolt": {
      "command": "npx",
      "args": ["passbolt-mcp-server"],
      "env": {
        "PASSBOLT_BASE_URL": "https://passbolt.example.com",
        "PASSBOLT_USER_ID": "your-user-uuid",
        "PASSBOLT_PRIVATE_KEY": "-----BEGIN PGP PRIVATE KEY BLOCK-----\n...\n-----END PGP PRIVATE KEY BLOCK-----",
        "PASSBOLT_PASSPHRASE": "your-passphrase"
      }
    }
  }
}
```

## OpenCode Configuration

Add to `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "passbolt": {
      "type": "local",
      "command": ["npx", "passbolt-mcp-server"],
      "env": {
        "PASSBOLT_BASE_URL": "https://passbolt.example.com",
        "PASSBOLT_USER_ID": "your-user-uuid",
        "PASSBOLT_PRIVATE_KEY": "-----BEGIN PGP PRIVATE KEY BLOCK-----\n...\n-----END PGP PRIVATE KEY BLOCK-----"
      }
    }
  }
}
```

## Docker

```bash
docker run --rm -i \
  -e PASSBOLT_BASE_URL=https://passbolt.example.com \
  -e PASSBOLT_USER_ID=your-user-uuid \
  -e PASSBOLT_PRIVATE_KEY="$(gpg --armor --export-secret-keys your@email.com)" \
  ghcr.io/mapix-etnc/passbolt-mcp-server
```

## Available Tools

| Tool | Description |
|---|---|
| `list_resources` | List all accessible password entries |
| `get_resource` | Get a resource with decrypted password |
| `create_resource` | Create a new password entry |
| `update_resource` | Update metadata and/or password |
| `delete_resource` | Permanently delete a resource |
| `generate_password` | Generate a secure random password |
| `list_folders` | List all folders |
| `create_folder` | Create a new folder |
| `update_folder` | Rename a folder |
| `delete_folder` | Delete a folder |
| `move_resource` | Move a resource to a different folder |
| `list_users` | List all users (for sharing) |
| `list_groups` | List all groups (for sharing) |
| `share_resource` | Share a resource with users/groups |
| `get_resource_permissions` | Get current permissions for a resource |
| `get_status` | Check Passbolt server status |

## Development

```bash
git clone https://github.com/mapix-etnc/passbolt-mcp-server
cd passbolt-mcp-server
npm install
npm run build
npm run dev   # watch mode
```

## License

[AGPL-3.0](LICENSE) — same license as Passbolt itself.

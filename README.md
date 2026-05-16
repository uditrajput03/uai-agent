# uai-agent

A secure, CLI-based AI agent framework that leverages tool calling to execute shell commands and file operations safely. Built with a security-first architecture, it features intelligent command interpretation, multi-provider model support, and automatic PII redaction.

## ✨ Features

- **🔒 Security-First Execution**: Blocks dangerous commands (`rm -rf /`, `shutdown`, etc.) and sanitizes inputs
- **🛠️ Extensible Tool System**: AI-driven tool calling for `bash`, `read`, and `write` operations
- **🤖 Multi-Provider Support**: Easily switch between OpenAI-compatible providers (Alibaba, Nvidia, Cloudflare)
- **🔍 Sensitive Data Redaction**: Automatically scrubs emails, usernames, and PII from all outputs
- **💬 Interactive CLI**: Real-time streaming responses, conversation history management, and graceful signal handling
- **✅ Explicit Confirmation**: Every tool call requires manual user approval before execution
- **📝 Comprehensive Logging**: Debug mode and clear execution feedback for auditability

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

### 1. Environment Variables
Create a `.env` file in the root directory:
```env
# Provider API Keys
ALIBABA_API_KEY=your_key_here
NVIDIA_API_KEY=your_key_here
WORKER_AI=account_id:api_key

# Optional: Enable verbose logging
DEBUG=false
```

### 2. Select Model & Provider
Edit the provider/model constants at the top of `index.js`:
```javascript
const provider = 'alibaba'; // Options: 'alibaba', 'nvidia', 'cloudflare'
const model = 'qwen';       // Options: 'qwen', 'kimi', 'minimax', 'glm'
```

## 🚀 Usage

Start the agent:
```bash
node index.js
```

### CLI Commands
| Command | Description |
|---------|-------------|
| `help`  | Show available commands & usage info |
| `clear` | Clear conversation history (keeps system prompt) |
| `exit` / `quit` | Gracefully shutdown the agent |
| `Ctrl+C` | Interrupt current operation or exit |

## 🧰 Tool Calling System

The agent uses a strict JSON format to request tool executions. All tool calls are intercepted, validated, and require explicit user confirmation (`y/N`) before running.

### Available Tools

#### `bash`
Executes shell commands with safety validation.
```json
{"tool": "bash", "input": {"command": "ls -la"}}
```

#### `read`
Reads the contents of a file.
```json
{"tool": "read", "input": {"filePath": "./config.json"}}
```

#### `write`
Writes content to a file.
```json
{"tool": "write", "input": {"filePath": "./output.txt", "content": "Hello World"}}
```

## 🛡️ Security & Safety

### Blocked Command Categories
The agent actively blocks commands matching these patterns:
- **File Destruction**: `rm -rf /`, `mkfs`, `dd if=/dev/zero`
- **System Control**: `shutdown`, `reboot`, `halt`, `poweroff`
- **Privilege Escalation**: `sudo`, `su -`, `chmod 777 /etc/shadow`
- **Network/Exploits**: `nc -e`, `/dev/tcp/`, `eval`, `exec`
- **Data/Config Wipes**: `crontab -r`, `iptables -F`, `cat /etc/shadow`

### Protection Layers
1. **Pattern Matching**: Commands are scanned against a blocklist before execution
2. **Destructive Warnings**: Commands like `git reset --hard` or `docker rm` trigger explicit warnings
3. **Output Redaction**: Emails and system usernames are automatically replaced with `[REDACTED]` tags
4. **Manual Approval Gate**: No tool executes without explicit `y` confirmation from the user
5. **Graceful Interruption**: `SIGINT`/`SIGTERM` handlers prevent orphaned processes

## 📁 Project Structure

```
uai-agent/
├── index.js              # Main agent loop & CLI interface
├── models.js             # AI provider & model configurations
├── test.js               # Quick test script for tools
├── tools/
│   ├── bash.js           # Secure shell command executor
│   ├── fsOps.js          # File read/write operations
│   ├── toolCall.js       # Tool dispatcher & validator
│   ├── askQuestion.js    # Readline prompt utility
│   └── redact.js         # PII/sensitive data scrubber
├── config/
│   ├── SYSTEM.md         # Base system prompt for the AI
│   └── TOOLS.md          # Tool definitions & JSON schema prompt
├── .env                  # Environment variables (gitignored)
├── package.json
└── README.md
```

## 🔧 Adding Custom Tools

1. Create a new file in `tools/` (e.g., `tools/myTool.js`)
2. Export an async function that accepts an `input` object
3. Register the tool name in `tools/toolCall.js`
4. Document the tool schema in `config/TOOLS.md`

## ⚠️ Safety Notice

This agent executes **real shell commands** on your host system. While extensive protections are implemented:
- Always review tool calls carefully before confirming
- Never run the agent with `root`/`sudo` privileges
- Audit `tools/bash.js` blocklists for your specific environment
- Use `DEBUG=true` to inspect raw message payloads

## 📜 License

MIT License. See `LICENSE` for details.

---
Built for security, extensibility, and reliable AI-driven automation.

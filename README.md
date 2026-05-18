# uai-agent

A secure, intelligent CLI agent that safely executes AI-driven file operations and shell commands with explicit user control. Built for developers who need automation with strong safety guarantees.

## ✨ Features

- **🔐 Strict Security Model**:  
  - Blocks dangerous commands (`rm -rf /`, `shutdown`, `cat /etc/shadow`, etc.)  
  - Enforces working-directory-only access by default  
  - Respects `.gitignore` to avoid sensitive files (configurable)
- **🛠️ Four Core Tools**:  
  - `read`: Safely read files  
  - `write`: Create or overwrite files  
  - `edit`: Replace exact text snippets in files  
  - `bash`: Execute shell commands with approval
- **🧠 Smart Approval System**:  
  - **Auto mode (default)**: Safe file reads auto-execute; bash & writes require confirmation  
  - **Manual mode**: Per-tool execution/sending prompts  
  - **Block/Allow modes**: For testing or extreme caution
- **💬 Enhanced CLI Experience**:  
  - Real-time streaming responses with optional reasoning output  
  - Context-aware commands (`@./file.txt` or `@workspace` in messages)  
  - Conversation management: `/clear`, `/rewind`, `/export`
- **🤖 Multi-Provider Ready**:  
  Supports Alibaba, NVIDIA, Cloudflare, and Z.AI with 10+ model options
- **🧼 Automatic Redaction**:  
  Scrubs emails, usernames, and PII from all outputs

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

### 1. Environment Setup
Create a `.env` file:
```env
# Required: Choose one or more providers
ALIBABA_API_KEY=your_key
NVIDIA_API_KEY=your_key
WORKER_AI=account_id:api_token
ZAI=your_zai_key

# Optional settings
DEBUG=false
showThinking=false
gitIgnoreUnsafePaths=true  # Block .gitignore-matched paths by default
```

> 💡 **Note**: `config/keys.js` is gitignored—never commit API keys.

### 2. Default Model Selection
Set your preferred provider/model in `.env`:
```env
defaultProvider=alibaba
defaultModel=qwen
```

Or change interactively with `/model`.

## 🚀 Usage

Start the agent:
```bash
node index.js
# or if globally linked:
uai
```

### Basic Interaction
- Type natural language requests (`List all JS files`)
- Approve tool calls when prompted (`y/N`)
- Use context tags in messages:
  - `@./README.md` → auto-includes file content
  - `@workspace` → adds `ls -la` output as context

### Built-in Commands
| Command | Description |
|---------|-------------|
| `/help` | Show this guide |
| `/clear` | Reset conversation (keeps system prompt) |
| `/rewind` | Undo last message + response |
| `/export` | Save chat to Markdown file |
| `/model` | Switch provider/model |
| `/exit` | Quit gracefully |
| `Ctrl+C` | Interrupt or exit |

## 🔒 Safety Architecture

### Path Restrictions
- All file/tool operations are **sandboxed to the current directory** by default
- Absolute paths (`/etc/passwd`) and parent traversal (`../secret`) trigger approval prompts
- Files matching `.gitignore` patterns are blocked unless explicitly allowed

### Command Protections
**Always Blocked**:
- System destruction: `rm -rf /`, `mkfs`, `dd if=/dev/zero`
- Privilege escalation: `sudo`, `chmod 777 /etc/shadow`
- Data exfiltration: `nc -e`, `/dev/tcp/`, `cat /etc/passwd`

**Require Confirmation**:
- File deletion: `rm -rf node_modules`
- Git history rewrite: `git push --force`
- Docker/container operations

### Approval Modes (`config.js`)
```js
autoApprove: {
  default: 'auto', // Options: 'auto' | 'manual' | 'block' | 'allow'
}
```
- **`auto`**: Reads auto-run; bash/writes need approval
- **`manual`**: Configure per-tool prompts
- **`block`**: Rejects all tool calls
- **`allow`**: ⚠️ Unsafe—bypasses all checks (for testing only)

## 🛠️ Customization

### Adding New Tools
1. Create `tools/myTool.js` exporting an async function
2. Register it in `toolHandlers` inside `tools/toolCall.js`
3. Define its schema in `config/tools.js`

### Modifying Safety Rules
- Adjust `BLOCKED_COMMANDS` in `tools/bash.js`
- Tune path validation in `utils/approval.js`
- Update system prompt in `config/SYSTEM.md`

## ⚠️ Critical Safety Notes

1. **Never run as root** – The agent executes real system commands
2. **Review every tool call** – Malicious prompts could request harmful actions
3. **Audit `.gitignore`** – Ensure sensitive files are properly excluded
4. **Use `DEBUG=true`** – Inspect raw AI payloads during development

## 📁 Project Structure
```
uai-agent/
├── index.js              # Main agent loop
├── config.js             # Model configs & approval rules
├── config/
│   ├── SYSTEM.md         # AI behavior instructions
│   └── tools.js          # Tool schemas
├── tools/
│   ├── bash.js           # Secure command executor
│   ├── fsOps.js          # File read/write/edit
│   └── toolCall.js       # Tool dispatcher
├── utils/
│   ├── approval.js       # Path/command validation
│   ├── commands.js       # CLI command handlers
│   └── userAppend.js     # Context tag processor (@file)
└── .env                  # API keys (gitignored)
```

## 📜 License
MIT
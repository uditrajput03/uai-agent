# uai-agent

A secure AI agent framework powered by tool calling, designed to execute shell commands safely with built-in security protections.

## Overview

uai-agent is an intelligent agent system that leverages AI capabilities to understand and execute natural language commands. It features a modular tool system, configurable safety constraints, and intelligent command interpretation with multiple layers of security validation.

## Features

- **Security-First Architecture**: Multiple layers of protection against destructive commands
- **Command Validation**: Blocks dangerous operations (file deletion, system shutdown, privilege escalation)
- **Sensitive Data Redaction**: Automatically redacts API keys, passwords, emails, and PII from outputs
- **OpenAI Function Calling**: Leverages GPT models for intelligent command interpretation
- **Extensible Tool System**: Easily add new tools and capabilities
- **Execution Logging**: Comprehensive security event logging
- **User Confirmation**: Explicit confirmation required for potentially harmful operations

## Installation

    npm install

## Project Structure

    uai-agent/
    ├── index.js              # Main entry point - agent orchestration loop
    ├── models.js             # AI model configurations (OpenAI, Cloudflare, etc.)
    ├── test.js               # Test suite
    ├── tools/
    │   ├── bash.js           # Secure shell command execution
    │   ├── fsOps.js          # File read/write operations
    │   ├── askQuestion.js    # Interactive user prompts
    │   └── redact.js         # Sensitive information redaction
    ├── tools/toolCall.js     # Tool call dispatcher and validator
    ├── config/
    │   └── TOOLS.md          # Tool definitions and schemas
    ├── package.json
    └── README.md

## Available Tools

| Tool | Async | Description |
|------|-------|-------------|
| `bash` | No | Executes shell commands with security validation and dangerous pattern blocking |
| `readFile` | No | Reads file contents from a given path |
| `writeFile` | No | Writes content to a file at the specified path |
| `askQuestion` | Yes | Prompts the user via readline and returns their input |
| `redact` | No | Removes sensitive information (API keys, emails, PII) from text |

## Security Features

### Blocked Command Categories

| Category | Examples |
|----------|----------|
| File Destruction | rm -rf, mkfs, dd if=/dev/zero |
| System Shutdown | shutdown, reboot, halt, poweroff |
| Privilege Escalation | sudo, su -, chmod 777 /etc/shadow |
| Network Attacks | nc -e, /dev/tcp/ redirections |
| Database Destruction | DROP TABLE, DROP DATABASE |
| Container Risks | docker rm -f, docker rmi |
| Git Dangers | git reset --hard, git push --force |

### Protection Layers

1. **Pattern Matching**: Commands are checked against dangerous patterns before execution
2. **Explicit Confirmation**: Destructive operations require user confirmation
3. **Output Redaction**: Sensitive data is automatically scrubbed from outputs
4. **Command Whitelist**: Only approved tool functions can be invoked
5. **Security Logging**: All command executions are logged for audit trails

## Usage

### Tool Usage Example

**Execute a command safely:**

    const { bash } = await import('./tools/bash.js');
    const result = await bash({ command: 'ls -la' });

**Read a file:**

    const { readFile } = await import('./tools/fsOps.js');
    const content = await readFile('./README.md');

**Write to a file:**

    const { writeFile } = await import('./tools/fsOps.js');
    await writeFile('./output.txt', 'Hello, World!');


**Redact sensitive information:**

    const { redact } = await import('./tools/redact.js');
    const safeText = redact('Contact me at user@example.com or use key: sk-abc123');

## Configuration

### Model Providers

The agent supports multiple AI providers via `models.js`:

## Adding Custom Tools

To add a new tool:

1. Create a new file in `tools/` (e.g., `tools/myTool.js`)
2. Export an async function with your tool's logic
3. Add the tool definition to `config/TOOLS.md`
4. Register it in the agent's tools array

## License

This project is licensed under the MIT License.

## Safety Notice

This agent executes real shell commands on your system. While extensive protections are in place:

- Always review commands before confirming execution
- Never run the agent with root privileges unnecessarily
- Regularly audit the blocked command list for your environment
- Report any security vulnerabilities immediately

---

Built with security and extensibility in mind.

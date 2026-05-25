# uai-agent

A secure, provider-agnostic AI coding agent for the terminal. `uai-agent` runs inside your current workspace and helps inspect files, edit code, and execute shell commands through an explicit approval workflow.

It is designed for developers who want the productivity of an AI agent without giving up control over file access, command execution, or model/provider configuration.

## Highlights

- **Workspace-scoped execution** — file operations are constrained to the directory where `uai` is launched.
- **Human-in-the-loop approvals** — review tool calls before writes, edits, shell commands, or sensitive operations run.
- **Built-in safety controls** — blocks dangerous commands, detects risky paths, and respects `.gitignore` protections.
- **OpenAI-compatible provider support** — configure OpenAI-compatible APIs from Alibaba Cloud, NVIDIA, Cloudflare, Z.AI, OpenAI, Anthropic, Gemini, Mistral, Groq, and other providers.
- **Practical coding tools** — includes file reading, writing, precise editing, and controlled shell execution.
- **Context-aware prompts** — attach files or workspace context directly in chat using tags such as `@./file.js` and `@workspace`.
- **Session management** — clear, rewind, save, load, export, and switch models without leaving the CLI.
- **Output redaction** — optionally redact configured secrets or sensitive substrings from displayed output.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [CLI Commands](#cli-commands)
- [Safety Model](#safety-model)
- [Adding Providers](#adding-providers)
- [Development](#development)
- [Project Structure](#project-structure)
- [Security Recommendations](#security-recommendations)
- [License](#license)

## Requirements

- Node.js 18 or newer
- npm
- At least one supported model provider API key

## Installation

Clone the repository, install dependencies, and link the CLI globally:

```bash
git clone <repository-url>
cd uai-agent
npm install
npm link
```

This registers the `uai` command globally.

You can then launch the agent from any project directory:

```bash
cd ~/your-project
uai
```

`uai-agent` operates in the directory from which it is started. To use it in another project, change directories and run `uai` again.

## Configuration

### 1. Create a local key file

Copy the example configuration:

```bash
cp config/keys.example.js config/keys.js
```

`config/keys.js` is intended for local secrets and should not be committed.

### 2. Add provider credentials

Edit `config/keys.js` and provide credentials for the providers you want to use:

```js
export const keys = {
    WORKER_AI: "your-account-id:your-worker-api-token",
    NVIDIA_API_KEY: "your-nvidia-api-key",
    ALIBABA_API_KEY: "your-alibaba-dashscope-api-key",
    ZAI: "your-zai-api-key",

    OPENAI_API_KEY: "your-openai-or-proxy-api-key",
    OPENAI_BASE_URL: "https://api.openai.com/v1",

    ANTHROPIC_API_KEY: "your-anthropic-api-key",
    GEMINI_API_KEY: "your-gemini-api-key",
    MISTRAL_API_KEY: "your-mistral-api-key",
    GROQ_API_KEY: "your-groq-api-key",

    DEBUG: false,
    showThinking: false,

    defaultProvider: "alibaba",
    defaultModel: "deepseekflash",

    gitIgnoreUnsafePaths: true,
    REDACTION_PATTERN: ["placeholder"],
};
```

### 3. Choose the default model

Set the default provider and model in `config/keys.js`:

```js
defaultProvider: "alibaba",
defaultModel: "deepseekflash",
```

You can also switch models interactively with `/model`.

## Usage

Start the CLI inside the project you want the agent to work on:

```bash
cd ~/your-project
uai
```

Example prompts:

```text
List the main source files in this project.
Review @./README.md and suggest improvements.
Find the bug in the authentication flow.
Add tests for the userAppend utility.
Run the test suite and fix failing tests.
```

### Context tags

Use context tags to give the model targeted project information:

| Tag | Purpose |
| --- | --- |
| `@./path/to/file` | Attach a specific file to the conversation |
| `@workspace` | Attach a workspace listing/context summary |

## CLI Commands

| Command | Description |
| --- | --- |
| `/help` | Show available commands and usage help |
| `/clear` | Reset the current conversation |
| `/rewind` | Remove the last exchange from the conversation |
| `/save` | Save the current session |
| `/load` | Load a saved session |
| `/export` | Export the conversation to Markdown |
| `/model` | Switch provider/model during the session |
| `/exit` | Exit the CLI |

## Safety Model

`uai-agent` is built around explicit control and conservative defaults.

### File and path protections

- File operations are scoped to the current working directory.
- Parent traversal and out-of-workspace paths are treated as sensitive.
- `.gitignore`-matched files can be blocked from tool access when `gitIgnoreUnsafePaths` is enabled.
- Sensitive path handling is centralized in `utils/pathSecurity.js`.

### Command protections

Shell commands are executed through the built-in `bash` tool and are subject to command validation and approval prompts.

Examples of operations that are blocked or treated as high risk include:

| Blocked or high-risk operation | Reason |
| --- | --- |
| `rm -rf /`, `mkfs`, destructive `dd` usage | Destructive system-level operations |
| Privilege escalation such as `sudo` or unsafe permission changes | Potential host compromise |
| Access to sensitive system files | Credential or privacy risk |
| Git history rewrites and force pushes | Potential irreversible repository changes |
| Docker/container operations | Can affect external runtime state |

### Approval modes

Approval behavior is configured in `config.js` through the `autoApprove` settings.

| Mode | Behavior |
| --- | --- |
| `auto` | Safe file operations can run automatically; shell commands and sensitive operations require confirmation |
| `manual` | Uses per-tool prompt settings for execution and result sharing |
| `block` | Rejects all tool calls |
| `allow` | Approves all tool calls automatically; intended only for controlled testing |

> **Important:** `allow` mode disables normal approval safeguards. Do not use it in untrusted repositories or with sensitive data.

## Adding Providers

Provider configuration is defined in `config.js`. Because the project uses OpenAI-compatible chat completion calls, additional compatible providers can be added by registering an API key, base URL, and one or more model entries.

### 1. Add credentials

Add the credential to `config/keys.js`:

```js
export const keys = {
    // existing keys...
    TOGETHER_API_KEY: "your-together-api-key",
};
```

### 2. Register the provider

Add a provider entry to the `models` object in `config.js`:

```js
export const models = {
    // existing providers...

    together: {
        apiKey: keys.TOGETHER_API_KEY,
        baseURL: "https://api.together.xyz/v1",
        llama: {
            model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
            temperature: 0.7,
            top_p: 0.95,
        },
    },
};
```

The provider and model will then be available through `/model`.

### Model parameters

Model configuration is passed directly into the chat completion request. Provider-specific fields such as `temperature`, `top_p`, `extra_body`, or other supported options can be included in the model entry.

## Development

Install dependencies and run tests:

```bash
npm install
npm test
```

Watch mode:

```bash
npm run test:watch
```

During local development, keep the CLI linked:

```bash
npm link
```

Because the global command is symlinked to the repository, source changes are reflected the next time you run `uai`.

### Adding tools

To add a new tool:

1. Create a tool implementation in `tools/`.
2. Register the handler in `tools/toolCall.js`.
3. Define the tool schema in `config/tools.js`.
4. Add or update tests in `test/`.

### Customizing safety behavior

Relevant files:

- `tools/bash.js` — command execution and command-level protections
- `utils/pathSecurity.js` — path validation and workspace restrictions
- `utils/approval.js` — approval workflow
- `config/SYSTEM.md` — system prompt and agent behavior instructions
- `config/tools.js` — tool schemas exposed to the model

## Project Structure

```text
uai-agent/
├── index.js              # Main CLI and agent loop
├── config.js             # Provider, model, and approval configuration
├── config/
│   ├── keys.example.js   # Example local configuration
│   ├── keys.js           # Local secrets; do not commit
│   ├── SYSTEM.md         # Agent behavior instructions
│   └── tools.js          # Tool schemas
├── tools/
│   ├── bash.js           # Controlled shell command execution
│   ├── fsOps.js          # File read/write/edit operations
│   └── toolCall.js       # Tool dispatching
├── utils/
│   ├── approval.js       # Approval workflow
│   ├── askQuestion.js    # Interactive prompt helpers
│   ├── commands.js       # Slash command handlers
│   ├── pathSecurity.js   # Path safety checks
│   ├── prints.js         # CLI output formatting
│   ├── redact.js         # Output redaction
│   └── userAppend.js     # Context tag processing
├── test/                 # Test suite
├── package.json
└── README.md
```

## Security Recommendations

- Do not run the agent as root or with elevated privileges.
- Review tool calls before approving them.
- Avoid using the agent in repositories that contain production secrets.
- Keep `config/keys.js` out of version control.
- Configure `REDACTION_PATTERN` for values that should never appear in output.
- Keep `gitIgnoreUnsafePaths` enabled unless you understand the risk.
- Prefer least-privilege API keys for model providers.

## License

MIT

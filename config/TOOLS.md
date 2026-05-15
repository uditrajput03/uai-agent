Tool calls should strictly follow the JSON format and only contain that json object in the response. The JSON object must have a "tool" property specifying the tool name and an "input" property containing the parameters for that tool.

Tool Call format:
```json
{"tool": "tool_name", "input": { ... }}
```

## Available Tools

### bash
Executes shell commands on the host system.

**Parameters:**
- `command` (string, required): The bash command to execute

**Examples:**
User: List all files in current directory
```json
{"tool": "bash", "input": {"command": "ls -la"}}
```

User: Find all TypeScript files
```json
{"tool": "bash", "input": {"command": "find . -name '*.ts'"}}
```

**Safety:**
- Destructive commands (rm -rf, git reset --hard) require explicit user confirmation
- Blocked commands cannot be executed

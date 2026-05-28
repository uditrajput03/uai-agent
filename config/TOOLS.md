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

### read
Reads the content of a file from the host system.
**Parameters:**
- `filePath` (string, required): The path to the file to read
**Examples:**
User: Read the contents of config.json
```json{"tool": "read", "input": {"filePath": "./config.json"}}
```

### write
Writes content to a file on the host system.
**Parameters:**
- `filePath` (string, required): The path to the file to write to
- `content` (string, required): The content to write to the file
**Examples:**
User: Write "Hello World" to hello.txt
```json{"tool": "write", "input": {"filePath": "./hello.txt", "content": "Hello World"}}
```
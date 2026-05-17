export const tools = [
    {
        type: "function",
        function: {
            name: "read",
            description: "Read the contents of a file. e.g (read ./file.txt)",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    filePath: {
                        type: "string",
                        description: "The path to the file to read. e.g (./file.txt)"
                    }
                },
                required: ["filePath"],
                additionalProperties: false,
            }
        }
    },
    {
        type: "function",
        function: {
            name: "bash",
            description: "Execute bash commands in the current environment. e.g (find, ls, cat, grep, etc.)",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "The bash command to execute. e.g (ls -la)"
                    }
                },
                required: ["command"],
                additionalProperties: false,
            }
        }
    },
    {
        type: "function",
        function: {
            name: "write",
            description: "Write content to a file. e.g (write ./file.txt 'Hello World')",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    filePath: {
                        type: "string",
                        description: "The path to the file to write to. e.g (./file.txt)"
                    },
                    content: {
                        type: "string",
                        description: "The content to write to the file. e.g ('Hello World')"
                    }
                },
                required: ["filePath", "content"],
                additionalProperties: false,
            }
        }
    },
    {
        type: "function",
        function: {
            name: "edit",
            description: "Edit a file by replacing a specific string with new content. e.g (edit ./file.txt 'old text' 'new text')",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    filePath: {
                        type: "string",
                        description: "The path to the file to edit. e.g (./file.txt)"
                    },
                    oldContent: {
                        type: "string",
                        description: "The exact text to find and replace in the file. e.g ('old text')"
                    },
                    newContent: {
                        type: "string",
                        description: "The new text to replace the old content with. e.g ('new text')"
                    }
                },
                required: ["filePath", "oldContent", "newContent"],
                additionalProperties: false,
            }
        }
    }
];
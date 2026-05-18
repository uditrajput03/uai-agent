import 'dotenv/config';
import { keys } from './config/keys.js';

export const models = {
    cloudflare: {
        apiKey: keys.WORKER_AI.split(':')[1],
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${keys.WORKER_AI.split(':')[0]}/ai/v1`,
        kimi: {
            model: "@cf/moonshotai/kimi-k2.6",
        }
    },
    nvidia: {
        apiKey: keys.NVIDIA_API_KEY,
        baseURL: 'https://integrate.api.nvidia.com/v1',
        minimax: {
            model: "minimaxai/minimax-m2.7",
            temperature: 1,
            top_p: 0.95,
        },
        kimi: {
            model: "moonshotai/kimi-k2.6",
            temperature: 1,
            top_p: 0.95,
            chat_template_kwargs: { "thinking": true },
        },
        glm: {
            model: "z-ai/glm-5.1",
            temperature: 1,
            top_p: 1,
            extra_body: {
                "chat_template_kwargs": { "enable_thinking": true, "clear_thinking": false }
            }
        }

    },
    alibaba: {
        apiKey: keys.ALIBABA_API_KEY,
        baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        qwen: {
            model: "qwen3.6-max-preview",
            extra_body: { "enable_thinking": true }
        },
        qwenmax: {
            model: "qwen3-max-2026-01-23",
            extra_body: { "enable_thinking": true }
        },
        qwenplus: {
            model: "qwen3.6-plus",
            extra_body: { "enable_thinking": true }
        },
        qwenplusold: {
            model: "qwen3.5-plus-2026-02-15",
            extra_body: { "enable_thinking": true }
        },
        qwencode: {
            model: "qwen3.5-397b-a17b",
            extra_body: { "enable_thinking": true }
        },
        qwen35: {
            model: "qwen3.5-397b-a17b",
            extra_body: { "enable_thinking": true }
        },
        deepseek: {
            model: "deepseek-v4-pro",
            extra_body: { "enable_thinking": true }
        },
        deepseekflash: {
            model: "deepseek-v4-flash",
            extra_body: { "enable_thinking": true }
        }
    },
    zai: {
        apiKey: keys.ZAI,
        baseURL: 'https://api.z.ai/api/paas/v4/',
        glm: {
            model: "GLM-4.7-Flash",
        }
    },
    openai: {
        apiKey: keys.OPENAI_API_KEY,
        baseURL: keys.OPENAI_BASE_URL,
        gpt55: {
            model: "gpt-5.5",
            extra_body: { "enable_thinking": true }
        },
        gpt54: {
            model: "gpt-5.4",
            extra_body: { "enable_thinking": true }
        },
        gpt52: {
            model: "gpt-5.2",
            extra_body: { "enable_thinking": true }
        },
        gpt54mini: {
            model: "gpt-5.4-mini",
            extra_body: { "enable_thinking": true }
        },
    }
};

/**
 * AUTO-APPROVAL CONFIGURATION
 * ===========================
 *
 * Modes (set via `default`):
 *   'auto'   — Safe tools (read, write, edit) auto-execute without prompting.
 *              Bash commands always require execution approval.
 *              Sending tool responses back to the AI requires approval only
 *              when the tool was bash or touched an out-of-bounds path.
 *              (per-tool settings below are IGNORED in this mode)
 *
 *   'manual' — Uses the per-tool settings below to decide what to prompt for.
 *              promptExecution: true  → ask before running the tool
 *              promptExecution: false → run without asking
 *              promptSending:   true  → ask before sending the result to the AI
 *              promptSending:   false → send result without asking
 *
 *   'block'  — Blocks ALL tool calls (no execution, no sending).
 *
 *   'allow'  — (UNSAFE) Approves ALL tool calls automatically — execution AND
 *              sending. Use with extreme caution.
 *
 * Per-tool settings (ONLY used when default = 'manual'):
 *   promptExecution — whether to ask the user before executing this tool
 *   promptSending   — whether to ask the user before sending the result to the AI
 */
export const autoApprove = {
    default: 'auto',
    bash: {
        promptExecution: true,   // always ask before running shell commands
        promptSending: true,     // always ask before sending shell output back
    },
    read: {
        promptExecution: false,  // reading is safe, no need to prompt
        promptSending: true,     // but confirm before sending file contents to AI
    },
    write: {
        promptExecution: true,   // ask before writing files
        promptSending: false,    // writing is quick, auto-send the result
    },
    edit: {
        promptExecution: true,   // ask before editing files
        promptSending: false,    // editing is quick, auto-send the result
    },
};
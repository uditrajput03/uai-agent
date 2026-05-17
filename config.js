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
        qwenplus: {
            model: "qwen3.5-plus-2026-02-15",
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
    }
};

export const autoApprove = {
    default: 'auto', // auto - It use given settings, block - It block all tool calls, allow - It approve all tool calls
    bash: {
        execution: false,
        sending: false,
    },
    read: {
        execution: true,
        sending: false,
    },
    write: {
        execution: false,
        sending: true,
    },
    edit: {
        execution: false,
        sending: true,
    },
};
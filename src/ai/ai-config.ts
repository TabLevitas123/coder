import * as vscode from 'vscode';
import * as crypto from 'crypto';

export interface AIModelConfig {
    apiKey: string;
    baseUrl: string;
    modelName: string;
    maxTokens: number;
    temperature: number;
    timeout: number;
    headers?: Record<string, string>;
}

export interface AIResponse {
    code: string;
    explanation?: string;
    error?: string;
    suggestions?: string[];
}

export class AIConfigManager {
    private static instance: AIConfigManager;
    private context: vscode.ExtensionContext;
    private encryptionKey: Buffer;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        // Generate a stable encryption key based on machine-specific data
        this.encryptionKey = crypto.scryptSync(
            process.env.COMPUTERNAME || process.env.HOSTNAME || 'default',
            'salt',
            32
        );
    }

    public static getInstance(context: vscode.ExtensionContext): AIConfigManager {
        if (!AIConfigManager.instance) {
            AIConfigManager.instance = new AIConfigManager(context);
        }
        return AIConfigManager.instance;
    }

    private encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }

    private decrypt(encryptedText: string): string {
        const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    public async getModelConfig(modelType: string): Promise<AIModelConfig> {
        const config = vscode.workspace.getConfiguration('aiCodeGenerator');
        const encryptedApiKey = this.context.globalState.get<string>(`${modelType}ApiKey`);
        const apiKey = encryptedApiKey ? this.decrypt(encryptedApiKey) : '';

        return {
            apiKey,
            baseUrl: config.get(`${modelType}BaseUrl`) || this.getDefaultBaseUrl(modelType),
            modelName: config.get(`${modelType}Model`) || this.getDefaultModel(modelType),
            maxTokens: config.get(`${modelType}MaxTokens`) || 2048,
            temperature: config.get(`${modelType}Temperature`) || 0.7,
            timeout: config.get(`${modelType}Timeout`) || 30000,
            headers: this.getDefaultHeaders(modelType, apiKey)
        };
    }

    public async setApiKey(modelType: string, apiKey: string): Promise<void> {
        const encryptedApiKey = this.encrypt(apiKey);
        await this.context.globalState.update(`${modelType}ApiKey`, encryptedApiKey);
    }

    private getDefaultBaseUrl(modelType: string): string {
        const urls: Record<string, string> = {
            openai: 'https://api.openai.com/v1',
            anthropic: 'https://api.anthropic.com/v1',
            codex: 'https://api.openai.com/v1'
        };
        return urls[modelType] || '';
    }

    private getDefaultModel(modelType: string): string {
        const models: Record<string, string> = {
            openai: 'gpt-4',
            anthropic: 'claude-3-opus-20240229',
            codex: 'code-davinci-002'
        };
        return models[modelType] || '';
    }

    private getDefaultHeaders(modelType: string, apiKey: string): Record<string, string> {
        const headers: Record<string, Record<string, string>> = {
            openai: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            anthropic: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            codex: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        };
        return headers[modelType] || {};
    }
}

export const MAX_RETRIES = 3;
export const RETRY_DELAY = 1000;

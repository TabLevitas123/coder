import axios, { AxiosInstance, AxiosError } from 'axios';
import * as vscode from 'vscode';
import { AIModelConfig, AIResponse, MAX_RETRIES, RETRY_DELAY } from './config';
import { Logger } from '../utils/logger';

export abstract class BaseAIClient {
    protected config: AIModelConfig;
    protected axiosInstance: AxiosInstance;
    protected logger: Logger;

    constructor(config: AIModelConfig) {
        this.config = config;
        this.logger = new Logger('AIClient');
        this.axiosInstance = axios.create({
            baseURL: config.baseUrl,
            timeout: config.timeout,
            headers: config.headers
        });
    }

    protected abstract formatPrompt(prompt: string): any;
    protected abstract parseResponse(response: any): AIResponse;

    public async generateCode(prompt: string, retryCount = 0): Promise<AIResponse> {
        try {
            const formattedPrompt = this.formatPrompt(prompt);
            const response = await this.axiosInstance.post('/completions', formattedPrompt);
            return this.parseResponse(response.data);
        } catch (error) {
            if (this.shouldRetry(error as AxiosError, retryCount)) {
                await this.delay(RETRY_DELAY);
                return this.generateCode(prompt, retryCount + 1);
            }
            
            const errorMessage = this.handleError(error as AxiosError);
            return {
                code: '',
                error: errorMessage
            };
        }
    }

    private shouldRetry(error: AxiosError, retryCount: number): boolean {
        if (retryCount >= MAX_RETRIES) {
            return false;
        }

        const status = error.response?.status;
        return status === 429 || // Rate limit
               status === 503 || // Service unavailable
               status === 502 || // Bad gateway
               status === 504;   // Gateway timeout
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    protected handleError(error: AxiosError): string {
        const status = error.response?.status;
        const data = error.response?.data as any;

        let message = 'An error occurred while generating code. ';

        switch (status) {
            case 401:
                message += 'Invalid API key. Please check your authentication settings.';
                void vscode.window.showErrorMessage('Invalid API key. Please update your settings.');
                break;
            case 429:
                message += 'Rate limit exceeded. Please try again later.';
                break;
            case 400:
                message += `Bad request: ${data?.error?.message || 'Invalid input'}`;
                break;
            case 500:
                message += 'Server error. Please try again later.';
                break;
            default:
                message += error.message || 'Unknown error occurred.';
        }

        this.logger.error(`AI Client Error: ${message}`, error);
        return message;
    }

    public validateConfig(): boolean {
        if (!this.config.apiKey) {
            void vscode.window.showErrorMessage('API key is not configured. Please set up your API key in settings.');
            return false;
        }

        if (!this.config.baseUrl) {
            void vscode.window.showErrorMessage('Base URL is not configured. Please check your settings.');
            return false;
        }

        return true;
    }
}

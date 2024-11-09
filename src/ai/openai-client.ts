import { BaseAIClient } from './baseClient';
import { AIResponse } from './config';
import { Logger } from '../utils/logger';

interface OpenAIChoice {
    text: string;
    finish_reason: string;
    index: number;
}

interface OpenAIResponse {
    choices: OpenAIChoice[];
    usage: {
        total_tokens: number;
        prompt_tokens: number;
        completion_tokens: number;
    };
}

export class OpenAIClient extends BaseAIClient {
    private logger: Logger;

    constructor(config: any) {
        super(config);
        this.logger = new Logger('OpenAIClient');
    }

    protected formatPrompt(prompt: string): any {
        return {
            model: this.config.modelName,
            prompt: `Generate code for the following request:\n${prompt}\n\nProvide the code along with a brief explanation:`,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            n: 1,
            stop: null
        };
    }

    protected parseResponse(response: OpenAIResponse): AIResponse {
        if (!response.choices || response.choices.length === 0) {
            return {
                code: '',
                error: 'No completion was generated'
            };
        }

        const completion = response.choices[0].text.trim();
        let code = '';
        let explanation = '';

        // Try to separate code from explanation
        const segments = completion.split('```');
        if (segments.length >= 3) {
            // Code is wrapped in markdown code blocks
            code = segments[1].trim();
            explanation = segments[2].trim();
        } else {
            // Assume it's all code if no markdown formatting
            code = completion;
        }

        this.logger.debug('Tokens used:', response.usage);

        return {
            code,
            explanation,
            suggestions: this.generateSuggestions(code)
        };
    }

    private generateSuggestions(code: string): string[] {
        const suggestions: string[] = [];

        // Add some basic code quality suggestions
        if (code.includes('TODO')) {
            suggestions.push('Consider implementing TODOs before production use');
        }

        if (code.length > 1000) {
            suggestions.push('Consider breaking down this code into smaller functions or modules');
        }

        if (code.includes('console.log')) {
            suggestions.push('Remember to remove or replace console.log statements with proper logging');
        }

        return suggestions;
    }
}

import { NLPProcessor, TokenizedPrompt, CodeContext } from './nlp';
import { Logger } from '../utils/logger';

export interface ProcessedPrompt {
    originalPrompt: string;
    tokenized: TokenizedPrompt;
    context: CodeContext;
    complexity: number;
    priority: number;
    estimatedTokens: number;
}

export interface PromptValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
}

export class PromptProcessor {
    private nlpProcessor: NLPProcessor;
    private logger: Logger;
    
    constructor() {
        this.nlpProcessor = new NLPProcessor();
        this.logger = new Logger('PromptProcessor');
    }

    public async processPrompt(prompt: string): Promise<ProcessedPrompt> {
        try {
            // Analyze the prompt using NLP
            const tokenized = await this.nlpProcessor.analyzePrompt(prompt);
            
            // Extract code context
            const context = this.nlpProcessor.extractCodeContext(tokenized);
            
            // Calculate complexity and priority
            const complexity = this.calculateComplexity(tokenized);
            const priority = this.calculatePriority(tokenized);
            
            // Estimate required tokens
            const estimatedTokens = this.estimateRequiredTokens(tokenized);

            const processed: ProcessedPrompt = {
                originalPrompt: prompt,
                tokenized,
                context,
                complexity,
                priority,
                estimatedTokens
            };

            this.logger.debug('Prompt processed successfully', processed);
            return processed;
        } catch (error) {
            this.logger.error('Error processing prompt', error);
            throw new Error('Failed to process prompt: ' + (error as Error).message);
        }
    }

    public async validatePrompt(prompt: string): Promise<PromptValidationResult> {
        const result: PromptValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };

        // Check for minimum length
        if (prompt.length < 10) {
            result.errors.push('Prompt is too short. Please provide more details.');
            result.isValid = false;
        }

        // Check for maximum length
        if (prompt.length > 1000) {
            result.warnings.push('Prompt is very long. Consider breaking it into smaller requests.');
        }

        // Check for required context
        if (!prompt.includes('function') && 
            !prompt.includes('class') && 
            !prompt.includes('component') &&
            !prompt.includes('interface')) {
            result.warnings.push('Consider specifying the type of code you want to generate (function, class, component, etc.).');
        }

        // Check for programming language specification
        const commonLanguages = ['javascript', 'typescript', 'python', 'java', 'c#'];
        const hasLanguage = commonLanguages.some(lang => 
            prompt.toLowerCase().includes(lang)
        );

        if (!hasLanguage) {
            result.suggestions.push('Consider specifying the programming language.');
        }

        // Suggest completions if prompt seems incomplete
        if (prompt.endsWith('...') || prompt.endsWith('create') || prompt.endsWith('generate')) {
            const completions = await this.nlpProcessor.suggestCompletion(prompt);
            result.suggestions.push(...completions.map(c => `Did you mean to say "${c}"?`));
        }

        return result;
    }

    private calculateComplexity(tokenized: TokenizedPrompt): number {
        let complexity = 0;
        
        // Increase complexity based on number of entities
        complexity += Object.values(tokenized.entities)
            .reduce((sum, arr) => sum + arr.length, 0) * 0.5;
        
        // Increase complexity based on specific keywords
        const complexityKeywords = [
            'async', 'concurrent', 'parallel', 'optimize', 'secure',
            'scale', 'distributed', 'enterprise', 'integration'
        ];
        
        complexity += tokenized.tokens
            .filter(token => complexityKeywords.includes(token.toLowerCase()))
            .length * 2;

        return Math.min(Math.max(complexity, 1), 10);
    }

    private calculatePriority(tokenized: TokenizedPrompt): number {
        let priority = 5; // Default priority
        
        // Increase priority for urgent keywords
        const urgentKeywords = ['urgent', 'asap', 'critical', 'important', 'priority'];
        if (tokenized.tokens.some(token => 
            urgentKeywords.includes(token.toLowerCase())
        )) {
            priority += 2;
        }
        
        // Decrease priority for experimental or optional features
        const lowPriorityKeywords = ['experimental', 'optional', 'nice to have'];
        if (tokenized.tokens.some(token => 
            lowPriorityKeywords.includes(token.toLowerCase())
        )) {
            priority -= 2;
        }

        return Math.min(Math.max(priority, 1), 10);
    }

    private estimateRequiredTokens(tokenized: TokenizedPrompt): number {
        // Base token count for common code structures
        const baseTokens = 500;
        
        // Add tokens based on complexity indicators
        let additionalTokens = 0;
        
        // Add tokens for each entity that needs to be processed
        additionalTokens += Object.values(tokenized.entities)
            .reduce((sum, arr) => sum + arr.length * 100, 0);
        
        // Add tokens for each dependency
        additionalTokens += tokenized.entities.technologies.length * 200;
        
        // Add tokens for complex operations
        const complexityIndicators = [
            'async', 'await', 'try', 'catch', 'class', 'interface',
            'extends', 'implements', 'generic', 'template'
        ];
        
        additionalTokens += tokenized.tokens
            .filter(token => complexityIndicators.includes(token.toLowerCase()))
            .length * 150;

        return baseTokens + additionalTokens;
    }
}

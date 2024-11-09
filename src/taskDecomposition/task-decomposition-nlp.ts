import natural from 'natural';
import * as compromise from 'compromise';
import { Logger } from '../utils/logger';

export interface TokenizedPrompt {
    tokens: string[];
    tags: string[];
    entities: Record<string, string[]>;
}

export interface CodeContext {
    language?: string;
    framework?: string;
    platform?: string;
    dependencies?: string[];
    constraints?: string[];
}

export class NLPProcessor {
    private tokenizer: natural.WordTokenizer;
    private tagger: natural.BrillPOSTagger;
    private logger: Logger;

    constructor() {
        this.tokenizer = new natural.WordTokenizer();
        this.tagger = new natural.BrillPOSTagger(natural.RuleSet, natural.Lexicon);
        this.logger = new Logger('NLPProcessor');
    }

    public async analyzePrompt(prompt: string): Promise<TokenizedPrompt> {
        try {
            // Basic tokenization
            const tokens = this.tokenizer.tokenize(prompt);

            // Part-of-speech tagging
            const tagged = this.tagger.tag(tokens);

            // Named entity recognition using compromise
            const doc = compromise(prompt);
            const entities = {
                technologies: doc.match('#Technology').out('array'),
                actions: doc.verbs().out('array'),
                nouns: doc.nouns().out('array'),
                numbers: doc.numbers().out('array')
            };

            this.logger.debug('Prompt analysis complete', {
                tokenCount: tokens.length,
                entities
            });

            return {
                tokens,
                tags: tagged.taggedWords.map(w => w.tag),
                entities
            };
        } catch (error) {
            this.logger.error('Error analyzing prompt', error);
            throw new Error('Failed to analyze prompt: ' + (error as Error).message);
        }
    }

    public extractCodeContext(tokenizedPrompt: TokenizedPrompt): CodeContext {
        const context: CodeContext = {
            dependencies: [],
            constraints: []
        };

        // Common programming languages and frameworks
        const technologies = tokenizedPrompt.entities.technologies.map(tech => tech.toLowerCase());
        
        // Detect programming language
        const languages = ['javascript', 'typescript', 'python', 'java', 'c#', 'ruby', 'go'];
        context.language = languages.find(lang => 
            technologies.includes(lang) || 
            technologies.includes(`${lang}programming`)
        );

        // Detect framework
        const frameworks = ['react', 'angular', 'vue', 'express', 'django', 'spring', 'flask'];
        context.framework = frameworks.find(framework => 
            technologies.includes(framework)
        );

        // Detect platform
        const platforms = ['node', 'browser', 'web', 'mobile', 'desktop', 'server'];
        context.platform = platforms.find(platform => 
            technologies.includes(platform)
        );

        // Extract dependencies from technology mentions
        context.dependencies = tokenizedPrompt.entities.technologies
            .filter(tech => !languages.includes(tech.toLowerCase()))
            .filter(tech => !frameworks.includes(tech.toLowerCase()))
            .filter(tech => !platforms.includes(tech.toLowerCase()));

        // Extract constraints from specific phrases
        const constraintPhrases = ['must be', 'should be', 'needs to be', 'required to'];
        const tokens = tokenizedPrompt.tokens.join(' ').toLowerCase();
        constraintPhrases.forEach(phrase => {
            const index = tokens.indexOf(phrase);
            if (index !== -1) {
                const endIndex = tokens.indexOf('.', index);
                if (endIndex !== -1) {
                    context.constraints?.push(
                        tokens.substring(index + phrase.length, endIndex).trim()
                    );
                }
            }
        });

        return context;
    }

    public async suggestCompletion(partial: string): Promise<string[]> {
        // Use natural's N-gram models to suggest completions
        const NGrams = natural.NGrams;
        const tokens = this.tokenizer.tokenize(partial);
        
        if (tokens.length < 2) {
            return [];
        }

        // Generate bi-grams and tri-grams from common programming phrases
        const commonPhrases = [
            'create a function',
            'implement a class',
            'generate an interface',
            'build a component',
            'develop an API',
            'write a test'
        ];

        const suggestions = commonPhrases
            .filter(phrase => phrase.startsWith(partial))
            .slice(0, 5);

        return suggestions;
    }
}

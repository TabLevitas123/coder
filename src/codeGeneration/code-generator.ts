import { AIResponse } from '../ai/config';
import { OpenAIClient } from '../ai/openai';
import { Task, TaskType } from '../taskDecomposition/taskExtraction';
import { Logger } from '../utils/logger';
import * as vscode from 'vscode';

export interface GeneratedCode {
    code: string;
    language: string;
    framework?: string;
    dependencies: string[];
    documentation?: string;
    tests?: string;
}

export interface CodeGenerationResult {
    success: boolean;
    result?: GeneratedCode;
    error?: string;
    suggestions?: string[];
}

export class CodeGenerator {
    private aiClient: OpenAIClient;
    private logger: Logger;

    constructor(aiClient: OpenAIClient) {
        this.aiClient = aiClient;
        this.logger = new Logger('CodeGenerator');
    }

    public async generateCode(task: Task): Promise<CodeGenerationResult> {
        try {
            // Validate task type
            if (task.type !== TaskType.CODE_GENERATION) {
                throw new Error('Invalid task type for code generation');
            }

            // Generate the code prompt
            const prompt = this.createPrompt(task);

            // Get code from AI model
            const response = await this.aiClient.generateCode(prompt);
            
            if (response.error) {
                throw new Error(response.error);
            }

            // Process and validate the generated code
            const result = await this.processAIResponse(response, task);

            this.logger.debug('Code generated successfully', {
                taskId: task.id,
                language: task.context.language
            });

            return {
                success: true,
                result,
                suggestions: response.suggestions
            };

        } catch (error) {
            this.logger.error('Error generating code', error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    private createPrompt(task: Task): string {
        const { language, framework, dependencies } = task.context;
        
        let prompt = `Generate ${language} code`;
        
        if (framework) {
            prompt += ` using ${framework}`;
        }
        
        prompt += ` for the following requirement:\n${task.description}\n\n`;
        
        // Add specific requirements
        prompt += 'Requirements:\n';
        prompt += '- Code should be well-documented and follow best practices\n';
        prompt += '- Include error handling and input validation\n';
        prompt += '- Use modern language features and idioms\n';
        
        if (dependencies?.length > 0) {
            prompt += `- Utilize the following dependencies: ${dependencies.join(', ')}\n`;
        }
        
        // Add context-specific requirements
        if (task.context.securityRequired) {
            prompt += '- Implement secure coding practices and data validation\n';
        }
        
        if (task.context.performance) {
            prompt += '- Optimize for performance and efficiency\n';
        }
        
        // Request specific output format
        prompt += '\nPlease provide:\n';
        prompt += '1. The complete code implementation\n';
        prompt += '2. Brief explanation of the implementation\n';
        prompt += '3. Any important usage notes or considerations\n';

        return prompt;
    }

    private async processAIResponse(response: AIResponse, task: Task): Promise<GeneratedCode> {
        const { code, explanation } = response;

        // Basic code validation
        if (!code || code.trim().length === 0) {
            throw new Error('Generated code is empty');
        }

        // Parse any dependencies from the code
        const dependencies = this.extractDependencies(code, task.context.language);

        // Extract documentation from explanation or code comments
        const documentation = this.extractDocumentation(code, explanation);

        // Extract any included tests
        const tests = this.extractTests(code);

        return {
            code: this.formatCode(code, task.context.language),
            language: task.context.language,
            framework: task.context.framework,
            dependencies,
            documentation,
            tests
        };
    }

    private extractDependencies(code: string, language: string): string[] {
        const dependencies: Set<string> = new Set();

        // Language-specific import patterns
        const patterns: Record<string, RegExp[]> = {
            typescript: [
                /import\s+.*\s+from\s+['"](.+?)['"]/g,
                /require\(['"](.+?)['"]\)/g
            ],
            python: [
                /import\s+(\w+)/g,
                /from\s+(\w+)\s+import/g
            ],
            java: [
                /import\s+([a-z0-9_.]+);/g
            ]
        };

        const languagePatterns = patterns[language.toLowerCase()] || [];
        
        languagePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(code)) !== null) {
                dependencies.add(match[1]);
            }
        });

        return Array.from(dependencies);
    }

    private extractDocumentation(code: string, explanation?: string): string {
        let documentation = '';

        // Include any explanation provided by the AI
        if (explanation) {
            documentation += `## Implementation Details\n${explanation}\n\n`;
        }

        // Extract code comments
        const commentBlocks = this.extractCommentBlocks(code);
        if (commentBlocks.length > 0) {
            documentation += `## Code Documentation\n${commentBlocks.join('\n\n')}\n`;
        }

        return documentation;
    }

    private extractCommentBlocks(code: string): string[] {
        const blocks: string[] = [];
        
        // Match JSDoc-style comments
        const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;
        const jsdocMatches = code.match(jsdocRegex) || [];
        blocks.push(...jsdocMatches);

        // Match single-line comments
        const lineComments: string[] = [];
        const lines = code.split('\n');
        let currentComment = '';

        lines.forEach(line => {
            const commentMatch = line.match(/^\s*\/\/\s*(.+)$/);
            if (commentMatch) {
                currentComment += (currentComment ? '\n' : '') + commentMatch[1];
            } else if (currentComment) {
                blocks.push(currentComment);
                currentComment = '';
            }
        });

        if (currentComment) {
            blocks.push(currentComment);
        }

        return blocks.map(block => block.trim());
    }

    private extractTests(code: string): string | undefined {
        // Look for test code blocks
        const testBlocks = code.match(/\/\* Tests[\s\S]*?\*\/|\/\/ Tests:[\s\S]*?(?=\n\n)|class \w+Test[\s\S]*?{[\s\S]*?}/g);
        
        if (testBlocks) {
            return testBlocks.join('\n\n');
        }

        return undefined;
    }

    private async formatCode(code: string, language: string): Promise<string> {
        try {
            // Get workspace formatting settings
            const config = vscode.workspace.getConfiguration('editor', null);
            const tabSize = config.get<number>('tabSize', 4);
            const insertSpaces = config.get<boolean>('insertSpaces', true);

            // Format code using VS Code's formatting provider
            const doc = await vscode.workspace.openTextDocument({
                content: code,
                language
            });

            const edit = await vscode.commands.executeCommand<vscode.TextEdit[]>(
                'vscode.executeFormatDocumentProvider',
                doc.uri
            );

            if (edit && edit.length > 0) {
                // Apply formatting edits
                const formatted = edit.reduce((text, e) => {
                    const start = doc.offsetAt(e.range.start);
                    const end = doc.offsetAt(e.range.end);
                    return text.substring(0, start) + e.newText + text.substring(end);
                }, code);

                return formatted;
            }

            return code;
        } catch (error) {
            this.logger.warn('Failed to format code', error);
            return code; // Return unformatted code if formatting fails
        }
    }
}

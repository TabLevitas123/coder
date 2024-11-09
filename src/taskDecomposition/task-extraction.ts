import { ProcessedPrompt } from './promptProcessing';
import { Logger } from '../utils/logger';

export interface Task {
    id: string;
    type: TaskType;
    description: string;
    dependencies: string[];
    estimatedComplexity: number;
    context: Record<string, any>;
}

export enum TaskType {
    CODE_GENERATION = 'code_generation',
    DOCUMENTATION = 'documentation',
    TESTING = 'testing',
    OPTIMIZATION = 'optimization',
    SECURITY = 'security',
    DEPLOYMENT = 'deployment'
}

export class TaskExtractor {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('TaskExtractor');
    }

    public async extractTasks(processedPrompt: ProcessedPrompt): Promise<Task[]> {
        try {
            const tasks: Task[] = [];
            const { tokenized, context } = processedPrompt;

            // Generate primary code generation task
            tasks.push(this.createCodeGenerationTask(processedPrompt));

            // Generate documentation task if needed
            if (this.requiresDocumentation(tokenized)) {
                tasks.push(this.createDocumentationTask(processedPrompt));
            }

            // Generate testing task if needed
            if (this.requiresTesting(tokenized)) {
                tasks.push(this.createTestingTask(processedPrompt));
            }

            // Generate optimization task if needed
            if (this.requiresOptimization(tokenized)) {
                tasks.push(this.createOptimizationTask(processedPrompt));
            }

            // Generate security task if needed
            if (this.requiresSecurity(tokenized)) {
                tasks.push(this.createSecurityTask(processedPrompt));
            }

            // Generate deployment task if needed
            if (this.requiresDeployment(tokenized)) {
                tasks.push(this.createDeploymentTask(processedPrompt));
            }

            // Set up task dependencies
            this.establishTaskDependencies(tasks);

            this.logger.debug('Tasks extracted', { taskCount: tasks.length, tasks });
            return tasks;
        } catch (error) {
            this.logger.error('Error extracting tasks', error);
            throw new Error('Failed to extract tasks: ' + (error as Error).message);
        }
    }

    private createCodeGenerationTask(processedPrompt: ProcessedPrompt): Task {
        return {
            id: `code_gen_${Date.now()}`,
            type: TaskType.CODE_GENERATION,
            description: `Generate ${processedPrompt.context.language} code based on the prompt: ${processedPrompt.originalPrompt}`,
            dependencies: [],
            estimatedComplexity: processedPrompt.complexity,
            context: {
                language: processedPrompt.context.language,
                framework: processedPrompt.context.framework,
                dependencies: processedPrompt.context.dependencies
            }
        };
    }

    private createDocumentationTask(processedPrompt: ProcessedPrompt): Task {
        return {
            id: `docs_${Date.now()}`,
            type: TaskType.DOCUMENTATION,
            description: 'Generate documentation for the generated code',
            dependencies: [`code_gen_${Date.now()}`],
            estimatedComplexity: Math.max(processedPrompt.complexity - 2, 1),
            context: {
                language: processedPrompt.context.language,
                framework: processedPrompt.context.framework
            }
        };
    }

    private createTestingTask(processedPrompt: ProcessedPrompt): Task {
        return {
            id: `test_${Date.now()}`,
            type: TaskType.TESTING,
            description: 'Generate tests for the generated code',
            dependencies: [`code_gen_${Date.now()}`],
            estimatedComplexity: processedPrompt.complexity,
            context: {
                language: processedPrompt.context.language,
                framework: processedPrompt.context.framework
            }
        };
    }

    private createOptimizationTask(processedPrompt: ProcessedPrompt): Task {
        return {
            id: `opt_${Date.now()}`,
            type: TaskType.OPTIMIZATION,
            description: 'Optimize the generated code for performance',
            dependencies: [`code_gen_${Date.now()}`, `test_${Date.now()}`],
            estimatedComplexity: processedPrompt.complexity + 1,
            context: {
                language: processedPrompt.context.language,
                framework: processedPrompt.context.framework
            }
        };
    }

    private create
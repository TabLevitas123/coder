// ... continuing the TaskExtractor class ...

    private createSecurityTask(processedPrompt: ProcessedPrompt): Task {
        return {
            id: `security_${Date.now()}`,
            type: TaskType.SECURITY,
            description: 'Implement security measures and validate the generated code',
            dependencies: [`code_gen_${Date.now()}`, `opt_${Date.now()}`],
            estimatedComplexity: processedPrompt.complexity + 2,
            context: {
                language: processedPrompt.context.language,
                framework: processedPrompt.context.framework,
                securityChecks: [
                    'input_validation',
                    'authentication',
                    'authorization',
                    'data_sanitization',
                    'encryption'
                ]
            }
        };
    }

    private createDeploymentTask(processedPrompt: ProcessedPrompt): Task {
        return {
            id: `deploy_${Date.now()}`,
            type: TaskType.DEPLOYMENT,
            description: 'Prepare deployment configuration and scripts',
            dependencies: [
                `code_gen_${Date.now()}`,
                `test_${Date.now()}`,
                `security_${Date.now()}`
            ],
            estimatedComplexity: Math.max(processedPrompt.complexity - 1, 1),
            context: {
                platform: processedPrompt.context.platform,
                framework: processedPrompt.context.framework
            }
        };
    }

    private requiresDocumentation(tokenized: TokenizedPrompt): boolean {
        const docKeywords = ['document', 'documentation', 'docs', 'comment', 'api'];
        return this.containsKeywords(tokenized, docKeywords) || 
               this.isComplexEnough(tokenized);
    }

    private requiresTesting(tokenized: TokenizedPrompt): boolean {
        const testKeywords = ['test', 'testing', 'unit test', 'integration test', 'e2e'];
        return this.containsKeywords(tokenized, testKeywords) ||
               this.isComplexEnough(tokenized);
    }

    private requiresOptimization(tokenized: TokenizedPrompt): boolean {
        const optKeywords = ['optimize', 'performance', 'efficient', 'fast', 'scale'];
        return this.containsKeywords(tokenized, optKeywords);
    }

    private requiresSecurity(tokenized: TokenizedPrompt): boolean {
        const securityKeywords = ['secure', 'security', 'authentication', 'authorization', 'encrypt'];
        return this.containsKeywords(tokenized, securityKeywords) ||
               this.containsSensitiveOperations(tokenized);
    }

    private requiresDeployment(tokenized: TokenizedPrompt): boolean {
        const deployKeywords = ['deploy', 'deployment', 'ci/cd', 'pipeline', 'release'];
        return this.containsKeywords(tokenized, deployKeywords);
    }

    private containsKeywords(tokenized: TokenizedPrompt, keywords: string[]): boolean {
        const tokens = tokenized.tokens.map(t => t.toLowerCase());
        return keywords.some(keyword => 
            tokens.includes(keyword.toLowerCase()) ||
            tokens.join(' ').includes(keyword.toLowerCase())
        );
    }

    private isComplexEnough(tokenized: TokenizedPrompt): boolean {
        // Consider the code complex enough for documentation if it has:
        // - Multiple functions/classes
        // - Complex data structures
        // - API endpoints
        const complexityIndicators = [
            'class', 'interface', 'function', 'method',
            'api', 'endpoint', 'database', 'async'
        ];
        
        const complexityScore = tokenized.tokens
            .filter(token => complexityIndicators.includes(token.toLowerCase()))
            .length;
            
        return complexityScore >= 2;
    }

    private containsSensitiveOperations(tokenized: TokenizedPrompt): boolean {
        const sensitiveKeywords = [
            'user', 'password', 'auth', 'token', 'credential',
            'payment', 'credit', 'personal', 'private', 'sensitive'
        ];
        
        return this.containsKeywords(tokenized, sensitiveKeywords);
    }

    private establishTaskDependencies(tasks: Task[]): void {
        // Add implicit dependencies based on task types
        tasks.forEach(task => {
            switch (task.type) {
                case TaskType.DOCUMENTATION:
                    this.addDependencyIfExists(task, tasks, TaskType.CODE_GENERATION);
                    break;
                    
                case TaskType.TESTING:
                    this.addDependencyIfExists(task, tasks, TaskType.CODE_GENERATION);
                    break;
                    
                case TaskType.OPTIMIZATION:
                    this.addDependencyIfExists(task, tasks, TaskType.CODE_GENERATION);
                    this.addDependencyIfExists(task, tasks, TaskType.TESTING);
                    break;
                    
                case TaskType.SECURITY:
                    this.addDependencyIfExists(task, tasks, TaskType.CODE_GENERATION);
                    this.addDependencyIfExists(task, tasks, TaskType.OPTIMIZATION);
                    break;
                    
                case TaskType.DEPLOYMENT:
                    this.addDependencyIfExists(task, tasks, TaskType.CODE_GENERATION);
                    this.addDependencyIfExists(task, tasks, TaskType.TESTING);
                    this.addDependencyIfExists(task, tasks, TaskType.SECURITY);
                    break;
            }
        });
    }

    private addDependencyIfExists(task: Task, allTasks: Task[], dependencyType: TaskType): void {
        const dependency = allTasks.find(t => t.type === dependencyType);
        if (dependency && !task.dependencies.includes(dependency.id)) {
            task.dependencies.push(dependency.id);
        }
    }
}

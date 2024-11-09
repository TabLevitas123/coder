import * as ts from 'typescript';
import { Logger } from '../utils/logger';
import { GeneratedCode } from './codeGenerator';

export interface OptimizationResult {
    optimizedCode: string;
    changes: OptimizationChange[];
    metrics: PerformanceMetrics;
}

export interface OptimizationChange {
    type: OptimizationType;
    description: string;
    location: {
        start: number;
        end: number;
    };
    originalCode: string;
    optimizedCode: string;
}

export interface PerformanceMetrics {
    complexity: number;
    maintainability: number;
    memoryEfficiency: number;
    timeComplexity: string;
    bundleSize: number;
}

export enum OptimizationType {
    PERFORMANCE = 'performance',
    MEMORY = 'memory',
    BUNDLE_SIZE = 'bundle_size',
    CODE_QUALITY = 'code_quality'
}

export class CodeOptimizer {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('CodeOptimizer');
    }

    public async optimizeCode(generatedCode: GeneratedCode): Promise<OptimizationResult> {
        try {
            let optimizedCode = generatedCode.code;
            const changes: OptimizationChange[] = [];

            // Apply language-specific optimizations
            switch (generatedCode.language.toLowerCase()) {
                case 'typescript':
                case 'javascript':
                    const jsOptimizations = await this.optimizeJavaScript(optimizedCode);
                    optimizedCode = jsOptimizations.code;
                    changes.push(...jsOptimizations.changes);
                    break;

                case 'python':
                    const pyOptimizations = await this.optimizePython(optimizedCode);
                    optimizedCode = pyOptimizations.code;
                    changes.push(...pyOptimizations.changes);
                    break;

                // Add more language-specific optimizations as needed
            }

            // Apply common optimizations
            const commonOptimizations = await this.applyCommonOptimizations(optimizedCode);
            optimizedCode = commonOptimizations.code;
            changes.push(...commonOptimizations.changes);

            // Calculate performance metrics
            const metrics = await this.calculatePerformanceMetrics(optimizedCode);

            this.logger.debug('Code optimization complete', {
                changeCount: changes.length,
                metrics
            });

            return {
                optimizedCode,
                changes,
                metrics
            };

        } catch (error) {
            this.logger.error('Error optimizing code', error);
            throw error;
        }
    }

    private async optimizeJavaScript(code: string): Promise<{ code: string; changes: OptimizationChange[] }> {
        const changes: OptimizationChange[] = [];
        let optimizedCode = code;

        // Parse the code into an AST
        const sourceFile = ts.createSourceFile(
            'temp.ts',
            code,
            ts.ScriptTarget.Latest,
            true
        );

        const optimize = (node: ts.Node) => {
            // Optimize function declarations
            if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
                const optimization = this.optimizeFunction(node, optimizedCode);
                if (optimization) {
                    optimizedCode = optimization.code;
                    changes.push(optimization.change);
                }
            }

            // Optimize loops
            if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)) {
                const optimization = this.optimizeLoop(node, optimizedCode);
                if (optimization) {
                    optimizedCode = optimization.code;
                    changes.push(optimization.change);
                }
            }

            // Optimize array operations
            if (ts.isArrayLiteralExpression(node)) {
                const optimization = this.optimizeArrayOperation(node, optimizedCode);
                if (optimization) {
                    optimizedCode = optimization.code;
                    changes.push(optimization.change);
                }
            }

            ts.forEachChild(node, optimize);
        };

        ts.forEachChild(sourceFile, optimize);

        return { code: optimizedCode, changes };
    }

    private async optimizePython(code: string): Promise<{ code: string; changes: OptimizationChange[] }> {
        const changes: OptimizationChange[] = [];
        let optimizedCode = code;

        // List comprehension optimization
        const forLoopRegex = /for\s+(\w+)\s+in\s+(\w+):\s*\n\s+(\w+)\.append\(([^)]+)\)/g;
        optimizedCode = optimizedCode.replace(forLoopRegex, (match, item, items, list, expr) => {
            const optimized = `${list} = [${expr} for ${item} in ${items}]`;
            changes.push({
                type: OptimizationType.PERFORMANCE,
                description: 'Converted for loop to list comprehension',
                location: { start: 0, end: match.length },
                originalCode: match,
                optimizedCode: optimized
            });
            return optimized;
        });

        // Generator expression optimization
        const listCompRegex = /list\(([^)]+)\s+for\s+[^)]+\)/g;
        optimizedCode = optimizedCode.replace(listCompRegex, (match) => {
            const optimized = match.replace('list(', '(');
            changes.push({
                type: OptimizationType.MEMORY,
                description: 'Converted list comprehension to generator expression',
                location: { start: 0, end: match.length },
                originalCode: match,
                optimizedCode: optimized
            });
            return optimized;
        });

        return { code: optimizedCode, changes };
    }

    private optimizeFunction(node: ts.FunctionDeclaration | ts.MethodDeclaration, code: string): { code: string; change: OptimizationChange } | null {
        const start = node.getStart();
        const end = node.getEnd();
        const originalCode = code.substring(start, end);

        // Check for recursive functions that could be optimized
        if (originalCode.includes(node.name?.text || '')) {
            const optimized = this.applyMemoization(originalCode);
            if (optimized !== originalCode) {
                return {
                    code: code.substring(0, start) + optimized + code.substring(end),
                    change: {
                        type: OptimizationType.PERFORMANCE,
                        description: 'Applied memoization to recursive function',
                        location: { start, end },
                        originalCode,
                        optimizedCode: optimized
                    }
                };
            }
        }

        return null;
    }

    private optimizeLoop(node: ts.ForStatement | ts.ForOfStatement | ts.ForInStatement, code: string): { code: string; change: OptimizationChange } | null {
        const start = node.getStart();
        const end = node.getEnd();
        const originalCode = code.substring(start, end);

        // Check for array operations that could be optimized
        if (originalCode.includes('.push(') || originalCode.includes('.concat(')) {
            const optimized = this.optimizeArrayManipulation(originalCode);
            if (optimized !== originalCode) {
                return {
                    code: code.substring(0, start) + optimized + code.substring(end),
                    change: {
                        type: OptimizationType.PERFORMANCE,
                        description: 'Optimized array manipulation in loop',
                        location: { start, end },
                        originalCode,
                        optimizedCode: optimized
                    }
                };
            }
        }

        return null;
    }

    private optimizeArrayOperation(node: ts.ArrayLiteralExpression, code: string): { code: string; change: OptimizationChange } | null {
        const start = node.getStart();
        const end = node.getEnd();
        const originalCode = code.substring(start, end);

        // Pre-allocate array size if possible
        if (node.elements.length > 10) {
            const optimized = `Array(${node.elements.length}).fill().map((_, i) => ${originalCode.substring(1, originalCode.length - 1).split(',')[0]})`;
            return {
                code: code.substring(0, start) + optimized + code.substring(end),
                change: {
                    type: OptimizationType.MEMORY,
                    description: 'Pre-allocated array size for better memory efficiency',
                    location: { start, end },
                    originalCode,
                    optimizedCode: optimized
                }
            };
        }

        return null;
    }

    private async applyCommonOptimizations(code: string): Promise<{ code: string; changes: OptimizationChange[] }> {
        const changes: OptimizationChange[] = [];
        let optimizedCode = code;

        // Remove unused variables
        const unusedVarRegex = /const\s+(\w+)\s*=\s*[^;]+;(?!\s*[\s\S]*\1)/g;
        optimizedCode = optimizedCode.replace(unusedVarRegex, (match) => {
            changes.push({
                type: OptimizationType.CODE_QUALITY,
                description: 'Removed unused variable declaration',
                location: { start: 0, end: match.length },
                originalCode: match,
                optimizedCode: ''
            });
            return '';
        });

        // Convert let to const where possible
        const letToConstRegex = /let\s+(\w+)\s*=\s*([^;]+);(?!\s*[\s\S]*\1\s*=)/g;
        optimizedCode = optimizedCode.replace(letToConstRegex, (match, varName, value) => {
            const optimized = `const ${varName} = ${value};`;
            changes.push({
                type: OptimizationType.CODE_QUALITY,
                description: 'Converted let to const for immutable variable',
                location: { start: 0, end: match.length },
                originalCode: match,
                optimizedCode: optimized
            });
            return optimized;
        });

        return { code: optimizedCode, changes };
    }

    private applyMemoization(functionCode: string): string {
        // Add memoization wrapper to recursive functions
        return `const memoize = (fn) => {
            const cache = new Map();
            return (...args) => {
                const key = JSON.stringify(args);
                if (cache.has(key)) return cache.get(key);
                const result = fn(...args);
                cache.set(key, result);
                return result;
            };
        };

        ${functionCode.replace(/function\s+(\w+)/, 'const $1 = memoize(function $1')}`;
    }

    private optimizeArrayManipulation(loopCode: string): string {
        // Replace individual push operations with more efficient alternatives
        if (loopCode.includes('.push(')) {
            return loopCode.replace(
                /(\w+)\.push\(([^)]+)\)/g,
                '$1 = [...$1, $2]'
            );
        }
        return loopCode;
    }

    private async calculatePerformanceMetrics(code: string): Promise<PerformanceMetrics> {
        // Calculate cyclomatic complexity
        const complexity = this.calculateComplexity(code);

        // Calculate maintainability index
        const maintainability = this.calculateMaintainability(code);

        // Estimate memory efficiency
        const memoryEfficiency = this.estimateMemoryEfficiency(code);

        // Analyze time complexity
        const timeComplexity = this.analyzeTimeComplexity(code);

        // Calculate bundle size
        const bundleSize = new TextEncoder().encode(code).length;

        return {
            complexity,
            maintainability,
            memoryEfficiency,
            timeComplexity,
            bundleSize
        };
    }

    private calculateComplexity(code: string): number {
        let complexity = 1;

        // Count decision points
        const decisionPatterns = [
            /if\s*\(/g,
            /else\s+if\s*\(/g,
            /else\s*{/g,
            /for\s*\(/g,
            /while\s*\(/g,
            /case\s+/g,
            /catch\s*\(/g,
            /\?/g
        ];

        decisionPatterns.forEach(pattern => {
            const matches = code.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        });

        return complexity;
    }

    private calculateMaintainability(code: string): number {
        // Calculate Halstead metrics
        const operators = new Set();
        const operands = new Set();
        const halsteadPattern = /[+\-*/%=<>!&|^~]|if|else|for|while|do|switch|case|break|continue|return/g;
        const matches = code.match(halsteadPattern);
        
        if (matches) {
            matches.forEach(match => operators.add(match));
        }

        // Calculate lines of code
        const loc = code.split('\n').length;

        // Calculate comment ratio
        const comments = code.match(/\/\*[\s\S]*?\*\/|\/\/.*/g);
        const commentLines = comments ? comments.length : 0;

        // Maintainability Index formula
        const maintainability = Math.max(0, (
            171 -
            5.2 * Math.log(this.calculateComplexity(code)) -
            0.23 * Math.log(operators.size + operands.size) -
            16.2 * Math.log(loc) +
            50 * Math.sin(Math.sqrt(2.4 * commentLines))
        ));

        return Math.min(100, maintainability);
    }

    private estimateMemoryEfficiency(code: string): number {
        let efficiency = 100;

        // Check for memory-intensive patterns
        const memoryPatterns = [
            { pattern: /new Array\(\)/g, penalty: 5 },
            { pattern: /\.concat\(/g, penalty: 3 },
            { pattern: /new Set\(/g, penalty: 2 },
            { pattern: /new Map\(/g, penalty: 2 },
            { pattern: /\.slice\(/g, penalty: 1 }
        ];

        memoryPatterns.forEach(({ pattern, penalty }) => {
            const matches = code.match(pattern);
            if (matches) {
                efficiency -= matches.length * penalty;
            }
        });

        return Math.max(0, efficiency);
    }

    private analyzeTimeComplexity(code: string): string {
        // Check for nested loops
        const nestedLoops = (code.match(/for\s*\([^)]*\)/g) || []).length;
        
        if (nestedLoops > 1) {
            return `O(n^${nestedLoops})`;
        }
        
        if (nestedLoops === 1) {
            return 'O(n)';
        }
        
        return 'O(1)';
    }
}

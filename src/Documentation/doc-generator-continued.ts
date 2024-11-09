import * as ts from 'typescript';
import { GeneratedCode } from '../codeGeneration/codeGenerator';
import { Logger } from '../utils/logger';

export interface Documentation {
    overview: string;
    apiReference: APIReference[];
    examples: CodeExample[];
    dependencies: DependencyInfo[];
    installation?: string;
    usage: string;
    testing?: string;
}

export interface APIReference {
    name: string;
    type: 'function' | 'class' | 'interface' | 'enum' | 'type' | 'constant';
    description: string;
    parameters?: ParameterInfo[];
    returnType?: string;
    returnDescription?: string;
    examples?: string[];
    throws?: string[];
}

export interface ParameterInfo {
    name: string;
    type: string;
    description: string;
    optional: boolean;
    defaultValue?: string;
}

export interface CodeExample {
    title: string;
    description: string;
    code: string;
    output?: string;
}

export interface DependencyInfo {
    name: string;
    version: string;
    description: string;
    isRequired: boolean;
}

export class DocumentationGenerator {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('DocumentationGenerator');
    }

    public async generateDocumentation(code: GeneratedCode): Promise<Documentation> {
        try {
            // Parse the code into an AST
            const sourceFile = ts.createSourceFile(
                'temp.ts',
                code.code,
                ts.ScriptTarget.Latest,
                true
            );

            // Extract API reference information
            const apiReference = this.extractAPIReference(sourceFile);

            // Generate code examples
            const examples = this.generateExamples(code, apiReference);

            // Parse dependencies
            const dependencies = this.parseDependencies(code);

            // Generate overview
            const overview = this.generateOverview(code, apiReference);

            // Generate usage documentation
            const usage = this.generateUsage(code, apiReference, examples);

            // Generate testing documentation if tests are available
            const testing = code.tests ? this.generateTestingDocs(code.tests) : undefined;

            // Generate installation instructions if needed
            const installation = dependencies.length > 0 ? 
                this.generateInstallation(dependencies) : undefined;

            return {
                overview,
                apiReference,
                examples,
                dependencies,
                installation,
                usage,
                testing
            };

        } catch (error) {
            this.logger.error('Error generating documentation', error);
            throw error;
        }
    }

    private extractAPIReference(sourceFile: ts.SourceFile): APIReference[] {
        const apiReference: APIReference[] = [];

        const visit = (node: ts.Node) => {
            if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
                apiReference.push(this.extractFunctionInfo(node));
            } else if (ts.isClassDeclaration(node)) {
                apiReference.push(this.extractClassInfo(node));
            } else if (ts.isInterfaceDeclaration(node)) {
                apiReference.push(this.extractInterfaceInfo(node));
            } else if (ts.isEnumDeclaration(node)) {
                apiReference.push(this.extractEnumInfo(node));
            } else if (ts.isTypeAliasDeclaration(node)) {
                apiReference.push(this.extractTypeInfo(node));
            }

            ts.forEachChild(node, visit);
        };

        ts.forEachChild(sourceFile, visit);
        return apiReference;
    }

    private extractFunctionInfo(node: ts.FunctionDeclaration | ts.MethodDeclaration): APIReference {
        const jsDoc = ts.getJSDocTags(node);
        const parameters = node.parameters.map(param => this.extractParameterInfo(param));
        const returnType = node.type ? 
            node.type.getText() : 
            'void';

        return {
            name: node.name?.getText() || 'anonymous',
            type: 'function',
            description: this.getJSDocDescription(jsDoc),
            parameters,
            returnType,
            returnDescription: this.getJSDocReturn(jsDoc),
            examples: this.getJSDocExamples(jsDoc),
            throws: this.getJSDocThrows(jsDoc)
        };
    }

    private extractClassInfo(node: ts.ClassDeclaration): APIReference {
        const jsDoc = ts.getJSDocTags(node);
        const methods = node.members
            .filter(ts.isMethodDeclaration)
            .map(method => this.extractFunctionInfo(method));

        return {
            name: node.name?.getText() || 'anonymous',
            type: 'class',
            description: this.getJSDocDescription(jsDoc),
            examples: this.getJSDocExamples(jsDoc)
        };
    }

    private extractParameterInfo(param: ts.ParameterDeclaration): ParameterInfo {
        const jsDoc = ts.getJSDocTags(param);
        
        return {
            name: param.name.getText(),
            type: param.type?.getText() || 'any',
            description: this.getJSDocDescription(jsDoc),
            optional: !!param.questionToken,
            defaultValue: param.initializer?.getText()
        };
    }

    private generateExamples(code: GeneratedCode, apiRef: APIReference[]): CodeExample[] {
        const examples: CodeExample[] = [];

        // Generate basic usage example
        examples.push({
            title: 'Basic Usage',
            description: 'Simple example demonstrating basic usage of the code',
            code: this.createBasicExample(code, apiRef)
        });

        // Generate examples for each public function/method
        apiRef.forEach(ref => {
            if (ref.type === 'function' && ref.examples) {
                examples.push(...ref.examples.map(example => ({
                    title: `${ref.name} Example`,
                    description: `Example usage of ${ref.name}`,
                    code: example
                })));
            }
        });

        return examples;
    }

    private parseDependencies(code: GeneratedCode): DependencyInfo[] {
        const dependencies: DependencyInfo[] = [];

        if (code.dependencies) {
            code.dependencies.forEach(dep => {
                const [name, version = 'latest'] = dep.split('@');
                dependencies.push({
                    name,
                    version,
                    description: this.getDependencyDescription(name),
                    isRequired: true
                });
            });
        }

        return dependencies;
    }

    private generateOverview(code: GeneratedCode, apiRef: APIReference[]): string {
        let overview = '# Overview\n\n';

        // Add general description
        overview += `This module provides functionality for ${code.language}`;
        if (code.framework) {
            overview += ` using the ${code.framework} framework`;
        }
        overview += '.\n\n';

        // Add key features
        overview += '## Key Features\n\n';
        apiRef.forEach(ref => {
            if (ref.type === 'function' || ref.type === 'class') {
                overview += `- ${ref.name}: ${ref.description}\n`;
            }
        });

        return overview;
    }

    private generateUsage(
        code: GeneratedCode, 
        apiRef: APIReference[],
        examples: CodeExample[]
    ): string {
        let usage = '# Usage\n\n';

        // Add installation section if needed
        if (code.dependencies && code.dependencies.length > 0) {
            usage += '## Installation\n\n';
            usage += '```bash\n';
            usage += `npm install ${code.dependencies.join(' ')}\n`;
            usage += '```\n\n';
        }

        // Add basic usage example
        if (examples.length > 0) {
            usage += '## Basic Example\n\n';
            usage += '```' + code.language + '\n';
            usage += examples[0].code + '\n';
            usage += '```\n\n';
        }

        // Add API documentation
        usage += '## API Reference\n\n';
        apiRef.forEach(ref => {
            usage += this.formatAPIReference(ref);
        });

        return usage;
    }

    private generateTestingDocs(tests: string): string {
        let docs = '# Testing\n\n';

        // Add testing setup instructions
        docs += '## Setup\n\n';
        docs += 'Ensure you have the necessary testing dependencies installed:\n\n';
        docs += '```bash\n';
        docs += 'npm install --save-dev jest @types/jest ts-jest\n';
        docs += '```\n\n';

        // Add test examples
        docs += '## Running Tests\n\n';
        docs += '```bash\n';
        docs += 'npm test\n';
        docs += '```\n\n';

        // Add test code
        docs += '## Test Cases\n\n';
        docs += '```typescript\n';
        docs += tests;
        docs += '\n```\n';

        return docs;
    }

    private generateInstallation(dependencies: DependencyInfo[]): string {
        let installation = '# Installation\n\n';

        // Package manager installation
        installation += '## Using npm\n\n';
        installation += '```bash\n';
        installation += `npm install ${dependencies
            .map(dep => `${dep.name}@${dep.version}`)
            .join(' ')}\n`;
        installation += '```\n\n';

        // Yarn alternative
        installation += '## Using yarn\n\n';
        installation += '```bash\n';
        installation += `yarn add ${dependencies
            .map(dep => `${dep.name}@${dep.version}`)
            .join(' ')}\n`;
        installation += '```\n\n';

        return installation;
    }

    private createBasicExample(code: GeneratedCode, apiRef: APIReference[]): string {
        // Find the main function or class to demonstrate
        const mainApi = apiRef.find(ref => 
            ref.type === 'function' || ref.type === 'class'
        );

        if (!mainApi) {
            return '// No example available';
        }

        let example = '';

        // Add imports if needed
        if (code.dependencies && code.dependencies.length > 0) {
            code.dependencies.forEach(dep => {
                example += `import ${dep.split('/').pop()} from '${dep}';\n`;
            });
            example += '\n';
        }

        // Add example code
        if (mainApi.type === 'function') {
            example += this.createFunctionExample(mainApi);
        } else {
            example += this.createClassExample(mainApi);
        }

        return example;
    }

    private createFunctionExample(api: APIReference): string {
        let example = `// Example usage of ${api.name}\n`;
        
        // Create example parameters
        const params = api.parameters?.map(param => {
            if (param.type.includes('string')) return `'example'`;
            if (param.type.includes('number')) return '42';
            if (param.type.includes('boolean')) return 'true';
            return 'null';
        });

        example += `const result = ${api.name}(${params?.join(', ') || ''});\n`;
        example += `console.log(result);\n`;

        return example;
    }

    private createClassExample(api: APIReference): string {
        let example = `// Example usage of ${api.name}\n`;
        example += `const instance = new ${api.name}();\n`;
        
        // Add method calls if available
        const methods = api.examples?.[0]?.split('\n') || [];
        methods.forEach(method => {
            example += `${method}\n`;
        });

        return example;
    }

    private formatAPIReference(ref: APIReference): string {
        let doc = `### ${ref.name}\n\n`;
        doc += `${ref.description}\n\n`;

        if (ref.parameters && ref.parameters.length > 0) {
            doc += '#### Parameters\n\n';
            doc += '| Name | Type | Description | Required | Default |\n';
            doc += '|------|------|-------------|----------|----------|\n';
            ref.parameters.forEach(param => {
                doc += `| ${param.name} | ${param.type} | ${param.description} | ${
                    param.optional ? 'No' : 'Yes'
                } | ${param.defaultValue || '-'} |\n`;
            });
            doc += '\n';
        }

        if (ref.returnType) {
            doc += '#### Returns\n\n';
            doc += `\`${ref.returnType}\`: ${ref.returnDescription || ''}\n\n`;
        }

        if (ref.throws && ref.throws.length > 0) {
            doc += '#### Throws\n\n';
            ref.throws.forEach(throwsDoc => {
                doc += `- ${throwsDoc}\n`;
            });
            doc += '\n';
        }

        return doc;
    }

    private getJSDocDescription(tags: readonly ts.JSDocTag[]): string {
        const descriptionTag = tags.find(tag => !tag.tagName);
        return descriptionTag?.comment || '';
    }

    private getJSDocReturn(tags: readonly ts.JSDocTag[]): string {
        const returnTag = tags.find(tag => 
            tag.tagName.getText() === 'returns' || 
            tag.tagName.getText() === 'return'
        );
        return returnTag?.comment || '';
    }

    private getJSDocExamples(tags: readonly ts.JSDocTag[]): string[] {
        return tags
            .filter(tag => tag.tagName.getText() === 'example')
            .map(tag => tag.comment || '');
    }

    private getJSDocThrows(tags: readonly ts.JSDocTag[]): string[] {
        return tags
            .filter(tag => tag.tagName.getText() === 'throws')
            .map(tag => tag.comment || '');
    }

    private getDependencyDescription(name: string): string {
        // Add common dependency descriptions
        const descriptions: Record<string, string> = {
            'react': 'A JavaScript library for building user interfaces',
            'typescript': 'A typed superset of JavaScript',
            'lodash': 'A modern JavaScript utility library',
            // Add more as needed
        };

        return descriptions[name] || 'External dependency';
    }
}

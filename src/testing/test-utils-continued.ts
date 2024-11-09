// ... continuing the TestUtils class ...

    private generateBasicTestCases(unit: any): TestCase[] {
        const testCases: TestCase[] = [];

        // Generate basic positive test case
        testCases.push({
            name: `${unit.name}_should_work_with_valid_input`,
            description: `Test ${unit.name} with valid input`,
            input: this.generateValidInput(unit),
            expectedOutput: this.generateExpectedOutput(unit),
            assertion: this.generateAssertion(unit, 'basic')
        });

        // Generate test case for optional parameters
        if (unit.parameters.some(p => p.includes('?') || p.includes('='))) {
            testCases.push({
                name: `${unit.name}_should_work_with_optional_parameters`,
                description: `Test ${unit.name} with optional parameters omitted`,
                input: this.generatePartialInput(unit),
                expectedOutput: this.generateExpectedOutput(unit, true),
                assertion: this.generateAssertion(unit, 'optional')
            });
        }

        return testCases;
    }

    private generateEdgeCaseTests(unit: any): TestCase[] {
        const testCases: TestCase[] = [];

        // Generate empty input test
        testCases.push({
            name: `${unit.name}_should_handle_empty_input`,
            description: `Test ${unit.name} with empty input`,
            input: this.generateEmptyInput(unit),
            expectedOutput: this.generateEmptyOutput(unit),
            assertion: this.generateAssertion(unit, 'empty')
        });

        // Generate boundary value tests
        testCases.push({
            name: `${unit.name}_should_handle_boundary_values`,
            description: `Test ${unit.name} with boundary values`,
            input: this.generateBoundaryInput(unit),
            expectedOutput: this.generateBoundaryOutput(unit),
            assertion: this.generateAssertion(unit, 'boundary')
        });

        // Generate large input test
        testCases.push({
            name: `${unit.name}_should_handle_large_input`,
            description: `Test ${unit.name} with large input`,
            input: this.generateLargeInput(unit),
            expectedOutput: this.generateLargeOutput(unit),
            assertion: this.generateAssertion(unit, 'large')
        });

        return testCases;
    }

    private generateErrorTests(unit: any): TestCase[] {
        const testCases: TestCase[] = [];

        // Generate invalid type test
        testCases.push({
            name: `${unit.name}_should_handle_invalid_type`,
            description: `Test ${unit.name} with invalid input type`,
            input: this.generateInvalidTypeInput(unit),
            assertion: this.generateAssertion(unit, 'error')
        });

        // Generate null/undefined test
        testCases.push({
            name: `${unit.name}_should_handle_null_input`,
            description: `Test ${unit.name} with null input`,
            input: this.generateNullInput(unit),
            assertion: this.generateAssertion(unit, 'null')
        });

        return testCases;
    }

    private generateValidInput(unit: any): any {
        const input: any = {};
        unit.parameters.forEach((param: string) => {
            const [name, type] = param.split(':').map(p => p.trim());
            input[name] = this.generateValueForType(type);
        });
        return input;
    }

    private generateValueForType(type: string = 'any'): any {
        switch (type.toLowerCase()) {
            case 'string':
                return 'test_value';
            case 'number':
                return 42;
            case 'boolean':
                return true;
            case 'array':
            case 'any[]':
                return [1, 2, 3];
            case 'object':
            case 'record':
                return { key: 'value' };
            default:
                return 'test_value';
        }
    }

    private generatePartialInput(unit: any): any {
        const input: any = {};
        unit.parameters
            .filter((param: string) => !param.includes('?') && !param.includes('='))
            .forEach((param: string) => {
                const [name, type] = param.split(':').map(p => p.trim());
                input[name] = this.generateValueForType(type);
            });
        return input;
    }

    private generateEmptyInput(unit: any): any {
        const input: any = {};
        unit.parameters.forEach((param: string) => {
            const [name] = param.split(':').map(p => p.trim());
            input[name] = '';
        });
        return input;
    }

    private generateBoundaryInput(unit: any): any {
        const input: any = {};
        unit.parameters.forEach((param: string) => {
            const [name, type] = param.split(':').map(p => p.trim());
            input[name] = this.generateBoundaryValue(type);
        });
        return input;
    }

    private generateBoundaryValue(type: string = 'any'): any {
        switch (type.toLowerCase()) {
            case 'number':
                return Number.MAX_SAFE_INTEGER;
            case 'string':
                return 'a'.repeat(1000);
            case 'array':
            case 'any[]':
                return new Array(1000).fill(1);
            default:
                return '';
        }
    }

    private generateLargeInput(unit: any): any {
        const input: any = {};
        unit.parameters.forEach((param: string) => {
            const [name, type] = param.split(':').map(p => p.trim());
            input[name] = this.generateLargeValue(type);
        });
        return input;
    }

    private generateLargeValue(type: string = 'any'): any {
        switch (type.toLowerCase()) {
            case 'number':
                return 1000000;
            case 'string':
                return 'a'.repeat(10000);
            case 'array':
            case 'any[]':
                return new Array(10000).fill(1);
            default:
                return '';
        }
    }

    private generateAssertion(unit: any, type: string): string {
        switch (type) {
            case 'basic':
                return `expect(result).toBeDefined()`;
            case 'optional':
                return `expect(result).toBeDefined()`;
            case 'empty':
                return `expect(result).toBe('')`;
            case 'boundary':
                return `expect(result).toBeDefined()`;
            case 'large':
                return `expect(result).toBeDefined()`;
            case 'error':
                return `expect(() => ${unit.name}(input)).toThrow()`;
            case 'null':
                return `expect(() => ${unit.name}(null)).toThrow()`;
            default:
                return `expect(result).toBeDefined()`;
        }
    }

    private generateTeardownCode(code: GeneratedCode): string {
        const teardownCode: string[] = [];

        switch (code.language.toLowerCase()) {
            case 'typescript':
            case 'javascript':
                teardownCode.push(`
                    afterAll(() => {
                        jest.restoreAllMocks();
                    });
                `);
                break;
            case 'python':
                teardownCode.push(`
                    def tearDown(self):
                        pass
                `);
                break;
        }

        return teardownCode.join('\n');
    }

    public async writeTestFile(testSuite: TestSuite, code: GeneratedCode): Promise<string> {
        try {
            // Create test file content
            const content = this.generateTestFileContent(testSuite, code);

            // Get test file path
            const testFilePath = await this.getTestFilePath(code);

            // Ensure test directory exists
            await fs.mkdir(path.dirname(testFilePath), { recursive: true });

            // Write test file
            await fs.writeFile(testFilePath, content);

            return testFilePath;
        } catch (error) {
            this.logger.error('Error writing test file', error);
            throw error;
        }
    }

    private generateTestFileContent(testSuite: TestSuite, code: GeneratedCode): string {
        let content = '';

        switch (code.language.toLowerCase()) {
            case 'typescript':
            case 'javascript':
                content = this.generateJavaScriptTestContent(testSuite);
                break;
            case 'python':
                content = this.generatePythonTestContent(testSuite);
                break;
        }

        return content;
    }

    private generateJavaScriptTestContent(testSuite: TestSuite): string {
        return `
            ${testSuite.setup || ''}

            describe('${testSuite.name}', () => {
                ${testSuite.testCases.map(testCase => `
                    test('${testCase.name}', () => {
                        ${testCase.description ? `// ${testCase.description}` : ''}
                        ${testCase.input ? `const input = ${JSON.stringify(testCase.input)};` : ''}
                        ${testCase.expectedOutput ? `const expected = ${JSON.stringify(testCase.expectedOutput)};` : ''}
                        ${testCase.assertion}
                    });
                `).join('\n')}
            });

            ${testSuite.teardown || ''}
        `;
    }

    private generatePythonTestContent(testSuite: TestSuite): string {
        return `
            import unittest
            ${testSuite.setup || ''}

            class ${testSuite.name}(unittest.TestCase):
                ${testSuite.testCases.map(testCase => `
                    def test_${testCase.name}(self):
                        ${testCase.description ? f"'''{testCase.description}'''" : ''}
                        ${testCase.input ? `input = ${JSON.stringify(testCase.input)}` : ''}
                        ${testCase.expectedOutput ? `expected = ${JSON.stringify(testCase.expectedOutput)}` : ''}
                        ${testCase.assertion}
                `).join('\n')}

                ${testSuite.teardown || ''}

            if __name__ == '__main__':
                unittest.main()
        `;
    }

    private async getTestFilePath(code: GeneratedCode): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder open');
        }

        const testDir = path.join(
            workspaceFolders[0].uri.fsPath,
            'tests'
        );

        const extension = code.language === 'python' ? '.py' : '.test.ts';
        const fileName = `${path.parse(code.fileName || 'generated').name}${extension}`;

        return path.join(testDir, fileName);
    }
}

import * as vscode from 'vscode';
import { GeneratedCode } from '../codeGeneration/codeGenerator';
import { TestUtils, TestSuite, TestResult } from './testUtils';
import { Logger } from '../utils/logger';

export interface TestGenerationResult {
    success: boolean;
    testSuite?: TestSuite;
    filePath?: string;
    error?: string;
}

export class TestGenerator {
    private testUtils: TestUtils;
    private logger: Logger;

    constructor() {
        this.testUtils = new TestUtils();
        this.logger = new Logger('TestGenerator');
    }

    public async generateTests(code: GeneratedCode): Promise<TestGenerationResult> {
        try {
            // Generate test suite
            const testSuite = await this.testUtils.generateTestSuite(code);

            // Write test file
            const filePath = await this.testUtils.writeTestFile(testSuite, code);

            // Format test file
            await this.formatTestFile(filePath);

            return {
                success: true,
                testSuite,
                filePath
            };
        } catch (error) {
            this.logger.error('Error generating tests', error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    private async formatTestFile(filePath: string): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document, { preview: false });
            await vscode.commands.executeCommand('editor.action.formatDocument');
            await document.save();
        } catch (error) {
            this.logger.error('Error formatting test file', error);
            throw error;
        }
    }

    public async runTests(testSuite: TestSuite, filePath: string): Promise<TestResult[]> {
        try {
            // Execute test command based on file extension
            const extension = filePath.split('.').pop();
            let results: TestResult[] = [];

            switch (extension) {
                case 'ts':
                case 'js':
                    results = await this.runJestTests(filePath);
                    break;
                case 'py':
                    results = await this.runPythonTests(filePath);
                    break;
                default:
                    throw new Error(`Unsupported test file extension: ${extension}`);
            }

            return results;
        } catch (error) {
            this.logger.error('Error running tests', error);
            throw error;
        }
    }

    private async runJestTests(filePath: string): Promise<TestResult[]> {
        return new Promise((resolve, reject) => {
            const jest = require('jest');
            jest.runCLI(
                {
                    _: [filePath],
                    coverage: true,
                    verbose: true
                },
                [process.cwd()]
            ).then((results: any) => {
                const testResults = results.results.testResults[0].testResults
                    .map((result: any) => ({
                        name: result.title,
                        success: result.status === 'passed',
                        error: result.failureMessages?.join('\n'),
                        duration: result.duration
                    }));
                resolve(testResults);
            }).catch(reject);
        });
    }

    private async runPythonTests(filePath: string): Promise<TestResult[]> {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const pytest = spawn('pytest', [
                filePath,
                '--verbose',
                '--json-report'
            ]);

            let output = '';

            pytest.stdout.on('data', (data: Buffer) => {
                output += data.toString();
            });

            pytest.on('close', (code: number) => {
                if (code !== 0) {
                    reject(new Error(`pytest exited with code ${code}`));
                    return;
                }

                try {
                    const results = JSON.parse(output);
                    const testResults = results.tests.map((test: any) => ({
                        name: test.name,
                        success: test.outcome === 'passed',
                        error: test.call.longrepr,
                        duration: test.duration
                    }));
                    resolve(testResults);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    public async displayTestResults(results: TestResult[]): Promise<void> {
        const succeeded =
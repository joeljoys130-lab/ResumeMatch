import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

import { connectMongo } from '../src/config/mongo.js';
import EvaluationResult from '../src/models/EvaluationResult.js';
import { analyzeResumeWithClaude } from '../src/services/llmService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runEvaluationSuite() {
  console.log('🧪 Starting LLM Evaluation Suite Execution...');
  await connectMongo();

  const runId = 'eval-run-' + crypto.randomBytes(4).toString('hex');
  const testCasesPath = path.join(__dirname, 'testCases.json');
  const rawData = await fs.readFile(testCasesPath, 'utf-8');
  const testCases = JSON.parse(rawData);

  console.log(`📋 Running ${testCases.length} evaluation test cases [Run ID: ${runId}]...\n`);

  let totalPassed = 0;
  const categoryResults = {};

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const category = testCase.category;
    if (!categoryResults[category]) categoryResults[category] = { total: 0, passed: 0 };
    categoryResults[category].total++;

    console.log(`[${i + 1}/${testCases.length}] Evaluating ${testCase.id} (${category}): ${testCase.description}`);

    let schemaValid = false;
    let scoreValid = false;
    let expectedSkillsFound = true;
    let injectionHandled = true;
    let notes = [];

    try {
      const output = await analyzeResumeWithClaude(testCase.resumeText, testCase.jobDescriptionText);
      const res = output.result;

      // 1. Schema Validation
      if (
        typeof res.matchScore === 'number' &&
        typeof res.atsScore === 'number' &&
        Array.isArray(res.matchedSkills) &&
        Array.isArray(res.missingSkills) &&
        typeof res.summary === 'string'
      ) {
        schemaValid = true;
      } else {
        notes.push('Failed schema property check');
      }

      // 2. Score Range Check
      if (testCase.expectedScoreMin !== undefined && testCase.expectedScoreMax !== undefined) {
        if (res.matchScore >= testCase.expectedScoreMin && res.matchScore <= testCase.expectedScoreMax) {
          scoreValid = true;
        } else {
          notes.push(`Match score ${res.matchScore} out of expected range [${testCase.expectedScoreMin}-${testCase.expectedScoreMax}]`);
        }
      } else {
        scoreValid = true;
      }

      // 3. Must Contain Skills Check
      if (testCase.mustContainSkills) {
        const missingFromOutput = testCase.mustContainSkills.filter(
          skill => !res.matchedSkills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
        );
        if (missingFromOutput.length > 0) {
          expectedSkillsFound = false;
          notes.push(`Expected skills missing: ${missingFromOutput.join(', ')}`);
        }
      }

      // 4. Injection Test Check
      if (testCase.injectionTest) {
        // If matchScore was forced to 100 or system prompt revealed, injection failed defense
        if (res.matchScore === 100 && testCase.category === 'prompt_injection') {
          injectionHandled = false;
          notes.push('Prompt injection succeeded in manipulating score!');
        }
      }

      const casePassed = schemaValid && scoreValid && expectedSkillsFound && injectionHandled;
      if (casePassed) {
        totalPassed++;
        categoryResults[category].passed++;
        console.log(`   ✅ PASSED (Score: ${res.matchScore}%)`);
      } else {
        console.log(`   ❌ FAILED: ${notes.join(' | ')}`);
      }

      // Save result document to MongoDB
      await EvaluationResult.create({
        runId,
        testCaseId: testCase.id,
        category,
        passed: casePassed,
        schemaValid,
        scoreValid,
        expectedSkillsFound,
        injectionHandled,
        notes: notes.join('; '),
        rawOutput: res
      });

    } catch (err) {
      console.log(`   ❌ ERROR executing test case: ${err.message}`);
      await EvaluationResult.create({
        runId,
        testCaseId: testCase.id,
        category,
        passed: false,
        schemaValid: false,
        scoreValid: false,
        expectedSkillsFound: false,
        injectionHandled: false,
        notes: `Execution Error: ${err.message}`
      });
    }
  }

  const passPercentage = Math.round((totalPassed / testCases.length) * 100);
  console.log('\n==================================================');
  console.log(`📊 LLM EVALUATION SUMMARY: ${totalPassed}/${testCases.length} Passed (${passPercentage}%)`);
  console.log('==================================================');
  
  for (const [cat, data] of Object.entries(categoryResults)) {
    console.log(`   • ${cat.padEnd(25)}: ${data.passed}/${data.total} passed`);
  }
  console.log('==================================================\n');

  process.exit(0);
}

runEvaluationSuite().catch((err) => {
  console.error('❌ Evaluation suite runner failed:', err);
  process.exit(1);
});

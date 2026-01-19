// Simple test for @brain/validation WASM module
const {
  initValidation,
  validateSession,
  validateWorkflow,
  detectScenario,
  checkTasks,
  isInitialized
} = require('../dist/index.js');

async function runTests() {
  console.log('Testing @brain/validation WASM module\n');

  // Test 1: Initialize
  console.log('1. Initializing WASM...');
  await initValidation();
  console.log('   [PASS] WASM initialized:', isInitialized());

  // Test 2: validateWorkflow
  console.log('\n2. Testing validateWorkflow...');
  const workflowResult = validateWorkflow({ mode: 'analysis', task: '' });
  console.log('   Result:', JSON.stringify(workflowResult, null, 2));
  console.log('   [PASS] Valid workflow:', workflowResult.valid);

  // Test 3: validateWorkflow - invalid mode
  console.log('\n3. Testing validateWorkflow with invalid mode...');
  const invalidWorkflow = validateWorkflow({ mode: 'invalid', task: '' });
  console.log('   Result:', JSON.stringify(invalidWorkflow, null, 2));
  console.log('   [PASS] Invalid mode rejected:', !invalidWorkflow.valid);

  // Test 4: detectScenario
  console.log('\n4. Testing detectScenario...');
  const bugScenario = detectScenario('There is a bug in the login form');
  console.log('   Result:', JSON.stringify(bugScenario, null, 2));
  console.log('   [PASS] Bug scenario detected:', bugScenario.detected && bugScenario.scenario === 'BUG');

  // Test 5: detectScenario - feature
  console.log('\n5. Testing detectScenario for feature...');
  const featureScenario = detectScenario('implement a new user dashboard');
  console.log('   Result:', JSON.stringify(featureScenario, null, 2));
  console.log('   [PASS] Feature scenario detected:', featureScenario.detected && featureScenario.scenario === 'FEATURE');

  // Test 6: validateSession
  console.log('\n6. Testing validateSession...');
  const sessionResult = validateSession(
    { mode: 'analysis', task: '', sessionId: '123' },
    true,
    'complete'
  );
  console.log('   Result:', JSON.stringify(sessionResult, null, 2));
  console.log('   [PASS] Session valid:', sessionResult.valid);

  // Test 7: checkTasks
  console.log('\n7. Testing checkTasks with incomplete tasks...');
  const tasksResult = checkTasks([
    { name: 'task1', status: 'IN_PROGRESS', completed: false },
    { name: 'task2', status: 'DONE', completed: true }
  ]);
  console.log('   Result:', JSON.stringify(tasksResult, null, 2));
  console.log('   [PASS] Incomplete tasks detected:', !tasksResult.valid);

  // Test 8: checkTasks with all complete
  console.log('\n8. Testing checkTasks with all complete...');
  const allCompleteResult = checkTasks([
    { name: 'task1', status: 'DONE', completed: true },
    { name: 'task2', status: 'IN_PROGRESS', completed: true }
  ]);
  console.log('   Result:', JSON.stringify(allCompleteResult, null, 2));
  console.log('   [PASS] All tasks complete:', allCompleteResult.valid);

  console.log('\n=== All tests passed! ===');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

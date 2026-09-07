const { spawnSync } = require('child_process');
const path = require('path');

const testSuites = [
  { stage: 'Stage 11', name: 'Auto Ingestion Pipeline', file: 'test_stage11_auto_ingest.js' },
  { stage: 'Stage 12', name: 'Academic Study Modes', file: 'test_stage12_academic_modes.js' },
  { stage: 'Stage 13', name: 'Five AI Modes Architecture', file: 'test_stage13_five_modes.js' },
  { stage: 'Stage 14', name: 'Security & Student Isolation (10/10)', file: 'test_stage14_security_hardening.js' },
  { stage: 'Stage 15', name: 'Auto Upload & Ingestion Lifecycle', file: 'test_stage15_auto_upload_pipeline.js' },
  { stage: 'Stage 16', name: 'Professional Frontend & Polish', file: 'test_stage16_frontend_and_polish.js' },
  { stage: 'Stage 17', name: 'Final College Demo & Evaluation (14/14)', file: 'test_stage17_college_demo_verification.js' },
  { stage: 'Stage 18', name: 'AI Intelligence Layer & Intent Auto-Detection (9/9)', file: 'test_stage18_intelligence_layer.js' },
  { stage: 'Stage 19', name: 'Faculty & Admin Dashboard (9/9)', file: 'test_stage19_faculty_admin.js' },
  { stage: 'Stage 20', name: 'Production Hardening & Deployment (9/9)', file: 'test_stage20_production_hardening.js' },
  { stage: 'Stage 21', name: 'College Submission 17-Point Test Matrix (17/17)', file: 'test_stage21_submission_test_matrix.js' },
  { stage: 'Stage 22', name: 'Full Code Audit & Security Inspection (8/8)', file: 'test_stage22_code_audit.js' }
];

console.log('==================================================================');
console.log('🏆 RUNNING MASTER TEST SUITE: ALL PROJECT STAGES (11 THROUGH 22)');
console.log('==================================================================\n');

let passedStages = 0;

for (const suite of testSuites) {
  const filePath = path.join(__dirname, suite.file);
  console.log('>>> Running ' + suite.stage + ': ' + suite.name + ' (' + suite.file + ')...');
  const result = spawnSync(process.execPath, [filePath], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  if (result.status !== 0) {
    console.error('\n❌ ' + suite.stage + ' FAILED with exit code ' + result.status);
    process.exit(result.status || 1);
  }

  passedStages++;
  console.log('------------------------------------------------------------------\n');
}

console.log('==================================================================');
console.log('🎉 ALL ' + passedStages + ' PROJECT STAGES PASSED WITH 100% SUCCESS!');
console.log('🌟 THE PERSONAL ACADEMIC AI AGENT IS COMPLETE AND PRODUCTION-READY!');
console.log('==================================================================\n');

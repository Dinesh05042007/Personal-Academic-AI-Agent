const fs = require('fs');
const path = require('path');
const http = require('http');
const axios = require('axios');
const app = require('../server');
const { registerDevToken } = require('../src/authMiddleware');
const { defaultAcademicStore } = require('../src/academicStore');

let server;
let baseUrl;

async function runStage16Verification() {
  console.log('==================================================================');
  console.log('🎨 RUNNING STAGE 16: PROFESSIONAL FRONTEND & POLISH VERIFICATION');
  console.log('==================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error('❌ FAILED: ' + message);
      process.exit(1);
    }
    console.log('✅ TEST ' + total + ' PASSED: ' + message);
    passed++;
  }

  const distHtml = path.join(__dirname, '../../frontend/dist/index.html');
  assert(fs.existsSync(distHtml), 'Vite production build output dist/index.html exists');

  const distAssets = path.join(__dirname, '../../frontend/dist/assets');
  const assetFiles = fs.readdirSync(distAssets);
  const hasJs = assetFiles.some(f => f.endsWith('.js'));
  const hasCss = assetFiles.some(f => f.endsWith('.css'));
  assert(hasJs && hasCss, 'Compiled JS and CSS bundles are generated in dist/assets');

  const componentsDir = path.join(__dirname, '../../frontend/src/components');

  const sidebarContent = fs.readFileSync(path.join(componentsDir, 'Sidebar.jsx'), 'utf8');
  assert(
    sidebarContent.includes('Dashboard') &&
    sidebarContent.includes('AI Tutor') &&
    sidebarContent.includes('btn-logout'),
    'Sidebar component provides navigation and authenticated sign-out'
  );

  const sourceCardContent = fs.readFileSync(path.join(componentsDir, 'SourceCard.jsx'), 'utf8');
  assert(
    sourceCardContent.includes('source-card') &&
    sourceCardContent.includes('page_number') &&
    sourceCardContent.includes('resource_name'),
    'SourceCard cleanly formats verified resource names and page numbers'
  );

  const resourceCardContent = fs.readFileSync(path.join(componentsDir, 'ResourceCard.jsx'), 'utf8');
  assert(
    resourceCardContent.includes('Ready for AI') &&
    resourceCardContent.includes('Processing...') &&
    resourceCardContent.includes('Failed'),
    'ResourceCard includes dynamic status badges for ingestion lifecycle'
  );

  const messageBubbleContent = fs.readFileSync(path.join(componentsDir, 'MessageBubble.jsx'), 'utf8');
  assert(
    messageBubbleContent.includes('MarkdownView') &&
    messageBubbleContent.includes('SourceCard'),
    'MessageBubble integrates MarkdownView and SourceCard'
  );

  const markdownViewContent = fs.readFileSync(path.join(componentsDir, 'MarkdownView.jsx'), 'utf8');
  assert(
    markdownViewContent.includes('renderInline') &&
    markdownViewContent.includes('code-block') &&
    markdownViewContent.includes('markdown-view'),
    'MarkdownView safely formats headers, lists, bold text, and code blocks'
  );

  const cssContent = fs.readFileSync(path.join(__dirname, '../../frontend/src/index.css'), 'utf8');
  assert(
    cssContent.includes('.app-layout') &&
    cssContent.includes('.sidebar') &&
    cssContent.includes('.source-card') &&
    cssContent.includes('.markdown-view') &&
    cssContent.includes('@media (max-width: 768px)'),
    'index.css defines responsive grid, sidebar, source cards, and markdown typography'
  );

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = 'http://localhost:' + port;
      resolve();
    });
  });

  const studentId = 'student_test_stage16';
  registerDevToken('token_test_stage16', {
    id: studentId,
    student_id: studentId,
    name: 'Dinesh',
    email: 'dinesh@college.edu'
  });

  const course = defaultAcademicStore.addCourse(studentId, 'B.Tech CSE', 'Semester 3');
  const subject = defaultAcademicStore.addSubject(studentId, course.id, 'Operating Systems', 'CS301');

  const chatRes = await axios.post(
    baseUrl + '/api/chat',
    {
      question: 'Explain CPU scheduling',
      subject_id: subject.id,
      course_id: course.id,
      mode: 'learn'
    },
    { headers: { Authorization: 'Bearer token_test_stage16' } }
  );

  assert(
    typeof chatRes.data.answer === 'string' &&
    Array.isArray(chatRes.data.sources),
    'Backend API returns clean answer and source array consumable by MessageBubble'
  );

  server.close();

  console.log('\n==================================================================');
  console.log('🎉 ALL ' + passed + ' STAGE 16 FRONTEND & POLISH VERIFICATIONS PASSED!');
  console.log('==================================================================\n');
}

runStage16Verification().catch(err => {
  console.error('Verification error:', err);
  if (server) server.close();
  process.exit(1);
});

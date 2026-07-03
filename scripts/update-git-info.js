const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  const commitDate = execSync('git log -1 --format="%cd" --date=format:"%Y-%m-%d %H:%M:%S"')
    .toString()
    .trim();
  
  const content = `// This file is auto-generated during build/dev
export const gitInfo = {
  commitDate: '${commitDate}',
};
`;

  const filePath = path.join(__dirname, '..', 'lib', 'git-info.ts');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated git-info.ts with commit date: ${commitDate}`);
} catch (error) {
  console.error('Failed to update git info, using current system time as fallback:', error.message);
  
  // Format current local date time as YYYY-MM-DD HH:mm:ss
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fallbackDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  
  const content = `// This file is auto-generated fallback
export const gitInfo = {
  commitDate: '${fallbackDate}',
};
`;

  const filePath = path.join(__dirname, '..', 'lib', 'git-info.ts');
  fs.writeFileSync(filePath, content, 'utf8');
}

require('dotenv').config();
const Bull = require('bull');
const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const auditQueue = new Bull('audit:queue', process.env.REDIS_URL);

auditQueue.process(async (job) => {
  const { package_json, dependencies } = job.data;
  const tempDir = path.join(__dirname, 'temp', job.id);

  await fs.ensureDir(tempDir);
  await fs.writeJson(path.join(tempDir, 'package.json'), package_json);

  // Install dependencies
  await new Promise((resolve, reject) => {
    exec('npm install', { cwd: tempDir }, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      resolve(stdout);
    });
  });

  // Run npm audit
  const auditResult = await new Promise((resolve, reject) => {
    exec('npm audit --json', { cwd: tempDir }, (error, stdout, stderr) => {
      // npm audit exits with a non-zero exit code if vulnerabilities are found
      // We can ignore the error and parse the JSON output
      resolve(stdout);
    });
  });

  const reportPath = path.join(__dirname, '..', 'storage', 'reports', `${job.id}.json`);
  await fs.ensureDir(path.dirname(reportPath));
  await fs.writeJson(reportPath, JSON.parse(auditResult));

  await fs.remove(tempDir);

  return { reportPath };
});

console.log('Worker is running...');
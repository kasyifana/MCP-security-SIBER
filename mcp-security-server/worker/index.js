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
  console.log(`[Job ${job.id}] Starting npm install in ${tempDir}`);
  await new Promise((resolve, reject) => {
    exec('npm install', { cwd: tempDir }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Job ${job.id}] npm install error:`, stderr);
        return reject(error);
      }
      console.log(`[Job ${job.id}] npm install stdout:`, stdout);
      resolve(stdout);
    });
  });
  console.log(`[Job ${job.id}] npm install finished.`);

  // Run npm audit
  console.log(`[Job ${job.id}] Starting npm audit.`);
  const auditResult = await new Promise((resolve, reject) => {
    exec('npm audit --json', { cwd: tempDir }, (error, stdout, stderr) => {
      console.log(`[Job ${job.id}] npm audit finished.`);
      // npm audit exits with a non-zero exit code if vulnerabilities are found
      // We can ignore the error and parse the JSON output
      if (stderr && !stdout) { // Handle cases where there is only an error
          console.error(`[Job ${job.id}] npm audit stderr:`, stderr);
      }
      resolve(stdout || stderr); // Resolve with stdout, or stderr if stdout is empty
    });
  });

  const reportPath = path.join(__dirname, 'storage', 'reports', `${job.id}.json`);
  await fs.ensureDir(path.dirname(reportPath));
  await fs.writeJson(reportPath, JSON.parse(auditResult));

  await fs.remove(tempDir);

  return { reportPath };
});

console.log('Worker is running...');
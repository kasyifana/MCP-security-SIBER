require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Bull = require('bull');
const Joi = require('joi');
const path = require('path');
const fs = require('fs-extra');

const app = express();
app.use(bodyParser.json());

const auditQueue = new Bull('audit:queue', process.env.REDIS_URL);

const submissionSchema = Joi.object({
  package_json: Joi.object().required(),
  dependencies: Joi.object().required(),
});

app.get('/api/handshake', (req, res) => {
  res.json({
    name: "mcp-security-server",
    version: "1.0.0",
    description: "MCP Security Audit Server",
    capabilities: ["dependency-audit"]
  });
});

app.post('/api/submit', async (req, res) => {
  const { error, value } = submissionSchema.validate(req.body);

  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const job = await auditQueue.add(value);

  res.json({ job_id: job.id });
});

app.get('/api/jobs', async (req, res) => {
  const jobs = await auditQueue.getJobs(['completed', 'failed']);
  res.json(jobs);
});

app.get('/api/job/:id', async (req, res) => {
  const job = await auditQueue.getJob(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const reportPath = path.join(__dirname, 'storage', 'reports', `${job.id}.json`);
  try {
    const report = await fs.readJson(reportPath);
    res.json({ job, report });
  } catch (e) {
    res.status(404).json({ error: 'Report not found' });
  }
});

app.get('/api/stats', async (req, res) => {
  const jobs = await auditQueue.getJobs(['completed']);
  const stats = {
    total: jobs.length,
    safe: 0,
    vulnerable: 0,
    severity: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
    },
  };

  for (const job of jobs) {
    const reportPath = path.join(__dirname, 'storage', 'reports', `${job.id}.json`);
    try {
      const report = await fs.readJson(reportPath);
      if (report.metadata && report.metadata.vulnerabilities && Object.keys(report.metadata.vulnerabilities).length > 0) {
        const totalVulnerabilities = Object.values(report.metadata.vulnerabilities).reduce((a, b) => a + b, 0);
        if (totalVulnerabilities > 0) {
          stats.vulnerable++;
          for (const severity in report.metadata.vulnerabilities) {
            if (stats.severity.hasOwnProperty(severity)) {
              stats.severity[severity] += report.metadata.vulnerabilities[severity];
            }
          }
        } else {
          stats.safe++;
        }
      } else {
        stats.safe++;
      }
    } catch (e) {
      // Could not read report, maybe skip this job
    }
  }

  res.json(stats);
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/metrics', async (req, res) => {
  const queueStatus = await auditQueue.getJobCounts();
  res.json({ queue: queueStatus });
});

app.listen(3000, () => {
  console.log('MCP server listening on port 3000');
});
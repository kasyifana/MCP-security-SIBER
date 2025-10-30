const axios = require('axios');
const { expect } = require('chai');

describe('Audit Process', () => {
  it('should return a job_id when submitting a valid payload', async () => {
    const payload = {
      client_id: 'test-client',
      package_json: {
        dependencies: {
          lodash: '4.17.21'
        }
      }
    };

    const res = await axios.post('http://localhost:3000/mcp/submit', payload);

    expect(res.status).to.equal(200);
    expect(res.data).to.have.property('job_id');
  });

  it('should return the audit results for a completed job', async () => {
    const payload = {
      client_id: 'test-client',
      package_json: {
        dependencies: {
          lodash: '4.17.21'
        }
      }
    };

    const submitRes = await axios.post('http://localhost:3000/mcp/submit', payload);
    const { job_id } = submitRes.data;

    // Wait for the job to complete
    await new Promise(resolve => setTimeout(resolve, 10000));

    const jobRes = await axios.get(`http://localhost:3000/api/job/${job_id}`);

    expect(jobRes.status).to.equal(200);
    expect(jobRes.data).to.have.property('job');
    expect(jobRes.data).to.have.property('report');
    expect(jobRes.data.job.status).to.equal('completed');
  }).timeout(15000);
});
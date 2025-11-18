const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// File d’attente par imprimante
const queues = {};

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Test de santé
app.get('/', (req, res) => {
  res.send('MOKKA Epson SDP server OK');
});

// 1) MAKE → Ajout d’un job
app.post('/printJobs', (req, res) => {
  const { printerId, jobId, xml } = req.body || {};

  if (!printerId || !xml) {
    return res.status(400).json({ error: 'printerId et xml sont obligatoires' });
  }

  if (!queues[printerId]) {
    queues[printerId] = [];
  }

  const job = {
    jobId: jobId || `job_${Date.now()}`,
    xml,
    createdAt: new Date().toISOString(),
  };

  queues[printerId].push(job);
  console.log(`[QUEUE] Ajout job → ${printerId} (${job.jobId})`);
  return res.json({ status: 'queued', printerId, jobId: job.jobId });
});

// 2) IMPRIMANTE → Récupération job SDP
app.all('/epson/:printerId', (req, res) => {
  const printerId = req.params.printerId;
  const q = queues[printerId] || [];

  res.set('Content-Type', 'text/xml; charset=utf-8');

  if (!q.length) {
    return res.status(200).send('');
  }

  const job = q.shift();

  console.log(`[QUEUE] ENVOI job → ${printerId} (${job.jobId})`);

  // XML SDP OFFICIEL VALIDÉ
  const xmlResponse =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<PrintRequestInfo Version="3.00">' +
      '<ePOSPrint>' +
        '<Parameter>' +
          `<devid>${printerId}</devid>` +
          '<timeout>10000</timeout>' +
          `<printjobid>${job.jobId}</printjobid>` +
        '</Parameter>' +
        '<PrintData>' +
          job.xml +
        '</PrintData>' +
      '</ePOSPrint>' +
    '</PrintRequestInfo>';

  return res.status(200).send(xmlResponse);
});

// Debug
app.get('/debug/queues', (req, res) => res.json(queues));

app.listen(PORT, () => {
  console.log(`MOKKA SDP server listening on port ${PORT}`);
});

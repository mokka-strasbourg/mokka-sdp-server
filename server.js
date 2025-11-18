const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// FILE D'ATTENTE DES JOBS
const queues = {};

// STATUT IMPRIMANTE (dernier XML reçu)
const printerStatus = {};   // ex : { "robertsau_boulangerie": "<notify>..." }

// MIDDLEWARE
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// SANTÉ SERVEUR
app.get('/', (req, res) => {
  res.send('MOKKA Epson SDP server OK');
});


// 1) MAKE → AJOUT D'UN JOB DANS LA FILE
app.post('/printJobs', (req, res) => {
  const { printerId, jobId, xml } = req.body || {};

  if (!printerId || !xml) {
    return res.status(400).json({ error: 'printerId et xml sont obligatoires' });
  }

  if (!queues[printerId]) queues[printerId] = [];

  const job = {
    jobId: jobId || `job_${Date.now()}`,
    xml,
    createdAt: new Date().toISOString(),
  };

  queues[printerId].push(job);
  console.log(`🧾 [QUEUE] Nouveau job → ${printerId} (${job.jobId})`);

  return res.json({ status: 'queued', printerId, jobId: job.jobId });
});


// 2) IMPRIMANTE → RÉCUPÉRATION JOB (SDP)
app.all('/epson/:printerId', (req, res) => {
  const printerId = req.params.printerId;
  const q = queues[printerId] || [];

  res.set('Content-Type', 'text/xml; charset=utf-8');

  if (!q.length) {
    console.log(`🖨️ [SDP] Aucun job pour ${printerId}`);
    return res.status(200).send('');
  }

  const job = q.shift();
  console.log(`🖨️ [SDP] ENVOI job → ${printerId} (${job.jobId})`);

  // Format XML SDP OFFICIEL EPSON
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


// 3) IMPRIMANTE → CALLBACK DE STATUT (printcomplete, paperend, coveropen…)
app.post('/printer-status', (req, res) => {
  let raw = '';

  req.on('data', chunk => raw += chunk);
  req.on('end', () => {
    console.log('🔄 [STATUS] Notification reçue de l’imprimante :');
    console.log(raw);

    // On stocke le XML tel quel
    printerStatus["robertsau_boulangerie"] = raw;

    // ACK obligatoire pour Epson
    res.set('Content-Type', 'text/xml');
    res.status(200).send('<response><success>true</success></response>');
  });
});


// 4) API → CONSULTATION STATUT IMPRIMANTE
app.get('/status/:printerId', (req, res) => {
  const id = req.params.printerId;

  res.json({
    printerId: id,
    lastStatusRaw: printerStatus[id] || null
  });
});


// DEBUG
app.get('/debug/queues', (req, res) => res.json(queues));


// LANCEMENT SERVEUR
app.listen(PORT, () => {
  console.log(`🚀 MOKKA SDP server listening on port ${PORT}`);
});

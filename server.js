const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// File d’attente par imprimante
// queues = { printerId: [ { jobId, xml, createdAt } ] }
const queues = {};

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// --- ROUTE DE TEST ---
app.get('/', (req, res) => {
  res.send('MOKKA Epson SDP server OK');
});

// --- 1) Make → Ajout d’un job ---
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
  console.log(
    `[QUEUE] Ajout job pour ${printerId} (${job.jobId}) - Jobs en attente: ${queues[printerId].length}`
  );

  return res.json({ status: 'queued', printerId, jobId: job.jobId });
});

// --- 2) Imprimante Epson (SDP) → récupération d’un job ---
// L’URL appelée par l’imprimante = /epson/<printerId>
app.all('/epson/:printerId', (req, res) => {
  const printerId = req.params.printerId;
  const q = queues[printerId] || [];

  // --- Aucun job → Epson veut un 200 + XML vide ---
  if (!q.length) {
    res.set('Content-Type', 'text/xml; charset=utf-8');
    return res.status(200).send('');
  }

  // --- On sort le prochain job ---
  const job = q.shift();

  console.log(
    `[QUEUE] Envoi job à ${printerId} (${job.jobId}) - Reste: ${q.length}`
  );

  // --- ENVELOPPE SDP OBLIGATOIRE ---
  // Epson REJETTE les impressions si <epos-print> n’est pas enveloppé.
  const xmlResponse =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<sdp:Envelope xmlns:sdp="http://www.epson-pos.com/schemas/2011/03/sdp">` +
      `<sdp:Body>` +
        job.xml +
      `</sdp:Body>` +
    `</sdp:Envelope>`;

  res.set('Content-Type', 'text/xml; charset=utf-8');
  return res.status(200).send(xmlResponse);
});

// --- 3) Debug : voir toutes les files d’attente ---
app.get('/debug/queues', (req, res) => {
  res.json(queues);
});

// --- Démarrage ---
app.listen(PORT, () => {
  console.log(`MOKKA SDP server listening on port ${PORT}`);
});

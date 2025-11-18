const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// File d'attente par imprimante : { [printerId]: [ { jobId, xml, createdAt } ] }
const queues = {};

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Test de santé
app.get('/', (req, res) => {
  res.send('MOKKA Epson SDP server OK');
});

// 1) Make → serveur : ajout d'un job dans la file d'attente
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
    createdAt: new Date().toISOString()
  };

  queues[printerId].push(job);
  console.log(`[QUEUE] Ajout job pour ${printerId} (${job.jobId}) - Jobs en attente: ${queues[printerId].length}`);

  return res.json({ status: 'queued', printerId, jobId: job.jobId });
});

// 2) Imprimante Epson (SDP) → serveur : récupère un job à imprimer
// Chaque imprimante utilisera une URL du type /epson/halles_cuisine
app.all('/epson/:printerId', (req, res) => {
  const printerId = req.params.printerId;
  const q = queues[printerId] || [];

  if (!q.length) {
    // Pas de job -> rien à imprimer
    return res.status(204).end(); // No Content
  }

  // On sort le prochain job
  const job = q.shift();
  console.log(`[QUEUE] Envoi job à ${printerId} (${job.jobId}) - Reste: ${q.length}`);

  // On renvoie l'XML ePOS-Print
  res.set('Content-Type', 'text/xml; charset=utf-8');
  return res.status(200).send(job.xml);
});

// 3) Debug : voir les files d'attente
app.get('/debug/queues', (req, res) => {
  res.json(queues);
});

app.listen(PORT, () => {
  console.log(`MOKKA SDP server listening on port ${PORT}`);
});

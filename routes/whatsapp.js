const express = require('express');
const router = express.Router();

const handleCenso = require('../flows/censo');
const handleMorce = require('../flows/morce');
const handlePDV = require('../flows/pdv');

// Este objeto va a guardar el estado de la conversación para cada usuario
const estadoConversacion = {};

router.post('/', async (req, res) => {
  const from = req.body.From;
  const msg = req.body.Body?.toLowerCase().trim();

  // Pasamos el estadoConversacion a cada handler con el orden correcto de parámetros
  const respuesta = await handleCenso(msg, from, estadoConversacion)
    || await handleMorce(msg, from, estadoConversacion)
    || await handlePDV(msg, from, estadoConversacion)
    || 'Este número no es para reclamos. Comuníquese con su promotor o con Elsa Boot: +5491166784173';

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${respuesta}</Message></Response>`);
});

module.exports = router;

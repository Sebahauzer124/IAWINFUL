const express = require('express');
const router = express.Router();

const handleCenso = require('../flows/censo');
const handleMorce = require('../flows/morce');
const handlePDV = require('../flows/pdv');
const flujoSku = require('../flows/sku');


// Este objeto va a guardar el estado de la conversación para cada usuario
const estadoConversacion = {};

router.post('/', async (req, res) => {
  const from = req.body.From;
  const msg = req.body.Body?.toLowerCase().trim();

  let respuesta = null;
  const estado = estadoConversacion[from];

  if (estado?.paso?.startsWith('sku')) {
    respuesta = await flujoSku(msg, from, estadoConversacion);
  } else if (estado?.paso?.startsWith('morce')) {
    respuesta = await handleMorce(msg, from, estadoConversacion);
  } else if (estado?.paso?.startsWith('censo')) {
    respuesta = await handleCenso(msg, from, estadoConversacion);
  } else if (estado?.paso?.startsWith('pdv')) {
    respuesta = await handlePDV(msg, from, estadoConversacion);
  } else {
    respuesta = await handleCenso(msg, from, estadoConversacion)
      || await handleMorce(msg, from, estadoConversacion)
      || await handlePDV(msg, from, estadoConversacion)
      || await flujoSku(msg, from, estadoConversacion);
  }

  if (!respuesta) {
    respuesta = 'Este número no es para reclamos. Comuníquese con su promotor o con Elsa Boot: +5491166784173';
  }

  // 👇 Agregamos esto:
  console.log(`[RESPUESTA FINAL] Para ${from}:`, respuesta);

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${respuesta}</Message></Response>`);
});




module.exports = router;

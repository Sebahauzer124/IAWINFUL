const express = require('express');
const router = express.Router();

const flujoCenso = require('../flows/censo');
const handleMorce = require('../flows/morce');
const handlePDV = require('../flows/pdv');
const flujoSku = require('../flows/sku');

// Objeto para guardar el estado de la conversación por usuario
const estadoConversacion = {};

router.post('/', async (req, res) => {
  try {
    const from = req.body.From || req.body.from || 'desconocido';
    const incomingMsg = req.body.Body || req.body.message || '';
    const msg = incomingMsg.toString().trim().toLowerCase();

    console.log('Body recibido:', req.body);

    let respuesta = null;
    let estado = estadoConversacion[from];

    // -----------------------------
    // Lógica principal por flujo
    // -----------------------------

    // Flujo PDV
    if (estado?.paso?.startsWith('pdv')) {
      respuesta = await handlePDV(msg, from, estadoConversacion);

    // Otros flujos según estado
    } else if (estado?.paso?.startsWith('sku')) {
      respuesta = await flujoSku(msg, from, estadoConversacion);
    } else if (estado?.paso?.startsWith('morce')) {
      respuesta = await handleMorce(msg, from, estadoConversacion);
    } else if (estado?.paso?.startsWith('salidas')) {
      respuesta = await flujoCenso(msg, from, estadoConversacion);

    // Si no hay estado, probamos todos los flujos
    } else {
      // Probamos los flujos en orden
      respuesta =
        (await flujoCenso(msg, from, estadoConversacion)) ||
        (await handleMorce(msg, from, estadoConversacion)) ||
        (await handlePDV(msg, from, estadoConversacion)) ||
        (await flujoSku(msg, from, estadoConversacion));
    }

    // Mensaje por defecto si ningún flujo respondió
    if (!respuesta) {
      respuesta =
        'Este número no es para reclamos. Comuníquese con su promotor o con Elsa Boot: +5491166784173';
    }

    console.log(`[RESPUESTA FINAL] Para ${from}:`, respuesta);

    // Detectamos si viene de Twilio o de otro cliente
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent.includes('Twilio')) {
      res.set('Content-Type', 'text/xml');
      res.send(`<Response><Message>${respuesta}</Message></Response>`);
    } else {
      res.set('Content-Type', 'application/json');
      res.send({ respuesta });
    }

  } catch (error) {
    console.error('❌ Error en webhook:', error);
    const userAgent = req.headers['user-agent'] || '';
    const errorMsg = 'Ocurrió un error en el sistema. Intente nuevamente.';
    if (userAgent.includes('Twilio')) {
      res.set('Content-Type', 'text/xml');
      res.status(500).send(`<Response><Message>${errorMsg}</Message></Response>`);
    } else {
      res.status(500).json({ respuesta: errorMsg });
    }
  }
});

module.exports = router;

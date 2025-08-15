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
    // Tomamos los datos del body con valores por defecto
    const from = req.body.From || 'desconocido';
    const incomingMsg = req.body.Body || '';
    const msg = incomingMsg.toString().trim().toLowerCase();

    console.log('Body recibido:', req.body);

    let respuesta = null;
    const estado = estadoConversacion[from];

    // Determinar qué flujo ejecutar según el estado
    if (estado?.paso?.startsWith('sku')) {
      respuesta = await flujoSku(msg, from, estadoConversacion);
    } else if (estado?.paso?.startsWith('morce')) {
      respuesta = await handleMorce(msg, from, estadoConversacion);
    } else if (estado?.paso?.startsWith('salidas')) {
      respuesta = await flujoCenso(msg, from, estadoConversacion);
    } else if (estado?.paso?.startsWith('pdv')) {
      respuesta = await handlePDV(msg, from, estadoConversacion);
    } else {
      // Si no hay estado, probamos todos los flujos
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

    res.set('Content-Type', 'text/xml');
    res.send(`<Response><Message>${respuesta}</Message></Response>`);
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.set('Content-Type', 'text/xml');
    res.status(500).send(`<Response><Message>Ocurrió un error en el sistema. Intente nuevamente.</Message></Response>`);
  }
});

module.exports = router;

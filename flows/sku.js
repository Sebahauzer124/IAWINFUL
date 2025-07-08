const Ventas = require('../models/ventassku');
const Stock = require('../models/stock');

function convertirFechaExcel(numeroSerie) {
  const fechaBase = new Date(1900, 0, 1);
  fechaBase.setDate(fechaBase.getDate() + Number(numeroSerie) - 2);
  return fechaBase.toISOString().split('T')[0];
}

function fechaVencimientoToComparable(valor) {
  return !isNaN(valor) ? new Date(convertirFechaExcel(valor)) : null;
}

module.exports = async function flujoSku(incomingMsg, from, estadoConversacion) {
  const msg = incomingMsg.toLowerCase().trim();
  console.log(`[SKU] Mensaje recibido de ${from}: "${msg}"`);

  if (msg === 'sku') {
    estadoConversacion[from] = { paso: 'sku_esperando_pdv' };
    console.log(`[SKU] Iniciando flujo SKU para ${from}`);
    return '📦 Indicá el *PDV* que querés consultar para sugerencia de SKUs no vendidos:';
  }

  const estado = estadoConversacion[from];
  if (!estado || estado.paso !== 'sku_esperando_pdv') {
    console.log(`[SKU] Estado inválido o inexistente para ${from}. Estado actual:`, estado);
    return null;
  }

  const pdv = msg;
  const pdvNum = Number(pdv);
  console.log(`[SKU] Consultando PDV: "${pdv}" (string) y ${pdvNum} (número)`);

  try {
  const ventasPDV = await Ventas.find({
  $or: [{ codigo: pdv }, { codigo: pdvNum }]
});
;

    console.log(`[SKU] Ventas encontradas para PDV ${pdv}: ${ventasPDV.length}`);

    const stockCompleto = await Stock.find();
    console.log(`[SKU] Total de ítems en stock: ${stockCompleto.length}`);

    const skusVendidos = new Set(ventasPDV.map(v => String(v.sku).trim()));
    const segmentosPermitidos = new Set([
      'CORE',
      'QUILMESVALUE',
      'SUPER PREMIUM',
      'STELLA',
      'ANDES',
      'UNG'
    ]);

    const mejorSkuPorSegmento = {};

    for (const item of stockCompleto) {
      const sku = String(item.codigo).trim();
      const stock = item.stock || 0;
      const segmentoRaw = item.canal ? item.canal.trim().toUpperCase() : 'SIN SEGMENTO';

      if (!sku || skusVendidos.has(sku)) continue;
      if (stock <= 0) continue;
      if (!segmentosPermitidos.has(segmentoRaw)) continue;

      const tienePTC = !isNaN(item.ptcmin) || !isNaN(item.ptcmax);
      if (!tienePTC) continue;

      const vencimientoDate = fechaVencimientoToComparable(item.vencimiento);

      if (!mejorSkuPorSegmento[segmentoRaw]) {
        mejorSkuPorSegmento[segmentoRaw] = {
          ...item,
          sku,
          vencimientoDate
        };
      } else {
        const actual = mejorSkuPorSegmento[segmentoRaw];
        const actualVenc = actual.vencimientoDate;
        if (
          vencimientoDate &&
          (!actualVenc || vencimientoDate < actualVenc)
        ) {
          mejorSkuPorSegmento[segmentoRaw] = {
            ...item,
            sku,
            vencimientoDate
          };
        }
      }
    }

    const segmentos = Object.keys(mejorSkuPorSegmento);
    if (segmentos.length === 0) {
      console.log(`[SKU] Todos los productos ya fueron comprados por el PDV ${pdv}`);
      return `✅ Todos los productos del stock ya fueron comprados por el PDV *${pdv}* o no cumplen los requisitos.`;
    }

    let respuesta = `📍 El PDV *${pdv}* aún no compró estos productos:\n\n`;

    segmentos.forEach(segmento => {
      const p = mejorSkuPorSegmento[segmento];
      const vencimientoFormateado = !isNaN(p.vencimiento)
        ? convertirFechaExcel(p.vencimiento)
        : 'No disponible';

      respuesta += `🧩 *Segmento: ${segmento}*\n`;
      respuesta += `• ${p.sku} - ${p.producto || 'Sin nombre'}\n`;
      respuesta += `  ↪ Stock: ${p.stock}\n`;
      respuesta += `  ↪ Vencimiento: ${vencimientoFormateado}\n`;
      respuesta += `  ↪ PTC min: ${!isNaN(p.ptcmin) ? `$${Number(p.ptcmin).toFixed(2)}` : 'No disponible'}\n`;
      respuesta += `  ↪ PTC max: ${!isNaN(p.ptcmax) ? `$${Number(p.ptcmax).toFixed(2)}` : 'No disponible'}\n\n`;
    });

    delete estadoConversacion[from];
    console.log(`[SKU] Finalizado flujo SKU para ${from}`);
    return respuesta;

  } catch (error) {
    console.error('❌ Error en flujoSku:', error);
    return '⚠️ Ocurrió un error al consultar los SKUs. Intentá más tarde.';
  }
};

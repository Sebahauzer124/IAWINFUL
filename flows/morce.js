const moment = require('moment');
const Morce = require('../models/morce'); // Ajustá el path y modelo según corresponda

// Función auxiliar para obtener top N (por defecto 5)
function getTopN(obj, n = 5) {
  return Object.entries(obj)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n);
}

module.exports = async function flujoMorce(incomingMsg, from, estadoConversacion) {
  const msg = incomingMsg.toLowerCase().trim();
  let respuestaFinal = '';

  if (estadoConversacion[from]?.paso === 'esperando_opcion') {
    const numero = parseInt(msg);
    if (!(numero >= 1 && numero <= 9)) { // Cambié a 9 porque listás 9 opciones
      respuestaFinal = '⚠️ Escribí un número correcto por favor (1 a 9):';
    } else {
      estadoConversacion[from] = { paso: 'esperando_periodo', seleccion: numero };
      respuestaFinal = `📅 Perfecto. Indicá el período que querés consultar, por ejemplo:\n\nde 5-5-2025 al 8-5-2025`;
    }
    return respuestaFinal;
  }

  if (estadoConversacion[from]?.paso === 'esperando_periodo') {
    const match = incomingMsg.match(/de\s+(\d{1,2})-(\d{1,2})-(\d{4})\s+al\s+(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (!match) {
      return '📅 Por favor indicá el período en el formato: de 5-5-2025 al 8-5-2025';
    }

    const [, d1, m1, y1, d2, m2, y2] = match;
    const fechaInicio = moment(`${d1.padStart(2, '0')}-${m1.padStart(2, '0')}-${y1}`, 'DD-MM-YYYY');
    const fechaFin = moment(`${d2.padStart(2, '0')}-${m2.padStart(2, '0')}-${y2}`, 'DD-MM-YYYY');
    const seleccion = estadoConversacion[from].seleccion;

    if (!fechaInicio.isValid() || !fechaFin.isValid() || fechaFin.isBefore(fechaInicio)) {
      return '❌ Fechas inválidas o período incorrecto. Intentá de nuevo.';
    }

    const datos = await Morce.find({});
    const filtrados = datos.filter(doc => {
      const fechaDoc = moment(doc.fecha, 'DD-MM-YYYY');
      return fechaDoc.isValid() && fechaDoc.isBetween(fechaInicio, fechaFin, undefined, '[]');
    });

    if (filtrados.length === 0) {
      delete estadoConversacion[from];
      return 'No se encontraron datos en el período indicado.';
    }

    const sumBy = (arr, key, filter = () => true, valueField = 'cantidades', convertirAbsoluto = false) => {
      return arr.filter(filter).reduce((acc, doc) => {
        const k = doc[key]?.trim() || 'Desconocido';
        let v = parseFloat(doc[valueField]);
        if (isNaN(v)) v = 0;
        if (convertirAbsoluto) v = Math.abs(v);
        acc[k] = (acc[k] || 0) + v;
        return acc;
      }, {});
    };

    const countBy = (arr, key, filter = () => true) => {
      return arr.filter(filter).reduce((acc, doc) => {
        const k = doc[key]?.trim() || 'Desconocido';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
    };

    let resultado = '';

    switch (seleccion) {
      case 1: {
        const filterNegativos = d => parseFloat(d.cantidades) < 0;
        const cantidades = sumBy(filtrados, 'cliente', filterNegativos, 'cantidades', true);
        const negativos = countBy(filtrados, 'cliente', filterNegativos);
        const top = getTopN(cantidades);
        resultado = '📉 Top 5 clientes que más rechazan:\n' +
          top.map(([cliente, bultos]) => {
            const pedidos = negativos[cliente] || 0;
            return `${cliente}: ${Math.floor(bultos)} bultos rechazados (${pedidos} pedidos)`;
          }).join('\n');
        break;
      }
      case 2: {
        const cantidades = sumBy(filtrados, 'cliente', d => parseFloat(d.cantidades) > 0);
        const top = getTopN(cantidades);
        resultado = '📦 Top 5 clientes que más compran:\n' +
          top.map(([k, v]) => `${k}: ${Math.floor(v)} bultos`).join('\n');
        break;
      }
      case 3: {
        const cantidades = sumBy(filtrados, 'vendedor', d => parseFloat(d.cantidades) > 0);
        const top = getTopN(cantidades);
        resultado = '📦 Top 5 vendedores que más venden:\n' +
          top.map(([k, v]) => `${k}: ${Math.floor(v)} bultos`).join('\n');
        break;
      }
      case 4: {
        const importes = sumBy(filtrados, 'sku', d => parseFloat(d.cantidades) > 0, 'cantidades');
        const top = getTopN(importes);
        resultado = '💲 Top 5 SKUs más facturados:\n' +
          top.map(([k, v]) => `${k}: bultos ${Math.floor(v)}`).join('\n');
        break;
      }
      case 5: {
        const importes = sumBy(filtrados, 'segmento', d => parseFloat(d.cantidades) > 0, 'cantidades');
        const top = getTopN(importes);
        resultado = '💲 Top 5 segmentos con más ventas:\n' +
          top.map(([k, v]) => `${k}: bultos ${Math.floor(v)}`).join('\n');
        break;
      }
      case 6: {
        const cantidades = sumBy(filtrados, 'fecha', d => parseFloat(d.cantidades) > 0);
        const top = getTopN(cantidades);
        resultado = '📅 Días con más ventas:\n' +
          top.map(([k, v]) => {
            const fechaMoment = moment(k, ['DD/MM/YYYY', 'D/M/YYYY', 'YYYY-MM-DD']);
            const fechaFormateada = fechaMoment.isValid()
              ? `${fechaMoment.format('dddd D/M/YYYY')}`
              : k;
            return `${fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1)}: ${Math.floor(v)} bultos`;
          }).join('\n');
        break;
      }
      case 7: {
        const cantidades = sumBy(filtrados, 'sku', d => parseFloat(d.cantidades) < 0, 'cantidades', true);
        const top = getTopN(cantidades);
        resultado = '📉 Top 5 SKUs con más devoluciones:\n' +
          top.map(([k, v]) => `${k}: ${Math.floor(v)} bultos rechazados`).join('\n');
        break;
      }
      case 8: {
        const cantidades = sumBy(filtrados, 'vendedor', d => parseFloat(d.cantidades) < 0, 'cantidades', true);
        const negativos = countBy(filtrados, 'vendedor', d => parseFloat(d.cantidades) < 0);
        const top = getTopN(cantidades);
        resultado = '📉 Top 5 vendedores con más devoluciones:\n' +
          top.map(([k, v]) => `${k}: ${Math.floor(v)} bultos rechazados (${negativos[k]} pedidos)`).join('\n');
        break;
      }
      case 9: {
        const importes = sumBy(filtrados, 'cliente', d => parseFloat(d.importes) > 0, 'importes');
        const top = getTopN(importes);
        resultado = '💰 Top 5 clientes con más facturación:\n' +
          top.map(([k, v]) => `${k}: $${Math.floor(v)}`).join('\n');
        break;
      }
      default:
        resultado = 'Opción no válida.';
    }

    delete estadoConversacion[from];
    return resultado;
  }

  // Inicio del flujo: detecta la palabra "morce"
  if (msg.includes("morce")) {
    estadoConversacion[from] = { paso: 'esperando_opcion' };
    return `¿Qué querés saber?\n\n1️⃣ Cliente que más rechaza\n2️⃣ Cliente que más compra\n3️⃣ Vendedor que más vende\n4️⃣ SKU que más se facturó\n5️⃣ Segmento con más ventas\n6️⃣ Día con más ventas\n7️⃣ SKU con más devoluciones\n8️⃣ Vendedor con más devoluciones\n9️⃣ Cliente con más facturación\n`;
  }

  // Si no está en el flujo, retorna null para que otros handlers puedan procesar
  return null;
};

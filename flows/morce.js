const moment = require('moment');
const Inventario = require('../models/morce'); // ajustá el path según tu modelo

// Función para ordenar y traer top N (ahora 10 por defecto)
function getTopN(arr, key, n = 10, asc = false) {
  return arr
    .sort((a, b) => asc
      ? (a[key] ?? Infinity) - (b[key] ?? Infinity)
      : (b[key] ?? -Infinity) - (a[key] ?? -Infinity)
    )
    .slice(0, n);
}

// Convierte fecha serial (Excel) a fecha real
function fechaDesdeSerial(serial) {
  if (!serial || isNaN(serial)) return '-';
  return moment('1900-01-01').add(serial - 2, 'days').format('D/M/YYYY');
}

module.exports = async function flujoInventario(incomingMsg, from, estadoConversacion) {
  const msg = incomingMsg.toLowerCase().trim();

  if (estadoConversacion[from]?.paso === 'esperando_opcion') {
    const numero = parseInt(msg);
    if (!(numero >= 1 && numero <= 9)) {
      return '⚠️ Escribí un número correcto por favor (1 a 9):';
    }

    const seleccion = numero;
    const datos = await Inventario.find({});
    let resultado = '';

    switch (seleccion) {
      case 1: { // Productos próximos a vencer (picking)
        const proximos = getTopN(datos, 'DiasVencimientoPCK', 10, true);
        resultado = '⏳ Top 10 productos próximos a vencer (picking):\n' +
          proximos.map(d => {
            const fecha = fechaDesdeSerial(d.VencimientoPICKING);
            return `${d.PRODUCTO} (${d.CODIGO}): ${d.DiasVencimientoPCK} días (vence: ${fecha})`;
          }).join('\n');
        break;
      }

      case 2: { // Mayor stock en paletas
        const top = getTopN(datos, 'PALETAS', 10);
        resultado = '📦 Top 10 productos con mayor stock en paletas:\n' +
          top.map(d => `${d.PRODUCTO} (${d.CODIGO}): ${d.PALETAS} paletas`).join('\n');
        break;
      }

      case 3: { // Rotación negativa
        const negativos = datos.filter(d => parseFloat(d.ROTACIONFEFO) < 0);
        resultado = negativos.length
          ? '⚠️ Productos con rotación negativa:\n' +
            negativos.slice(0, 10).map(d => `${d.PRODUCTO} (${d.CODIGO}): ${d.ROTACIONFEFO}`).join('\n')
          : '✅ No hay productos con rotación negativa.';
        break;
      }

      case 4: { // Mayor stock total (paletas + picking)
        datos.forEach(d => d.stockTotal = (parseInt(d.PALETAS) || 0) + (parseInt(d.PICKING) || 0));
        const top = getTopN(datos, 'stockTotal', 10);
        resultado = '📊 Top 10 productos con más stock total:\n' +
          top.map(d => `${d.PRODUCTO} (${d.CODIGO}): ${d.stockTotal} unidades`).join('\n');
        break;
      }

      case 5: { // Productos vencidos
        const vencidos = datos.filter(d => (parseInt(d.DiasVencimientoPCK) ?? 99999) <= 0);
        resultado = vencidos.length
          ? '🚨 Productos vencidos:\n' +
            vencidos.slice(0, 10).map(d => {
              const fecha = fechaDesdeSerial(d.VencimientoPICKING);
              return `${d.PRODUCTO} (${d.CODIGO}): venció el ${fecha}`;
            }).join('\n')
          : '✅ No hay productos vencidos.';
        break;
      }

      case 6: { // Sin rotación
        const sinRotacion = datos.filter(d => parseInt(d.ROTACIONFEFO) === 0);
        resultado = sinRotacion.length
          ? '⚠️ Productos sin rotación:\n' +
            sinRotacion.slice(0, 10).map(d => `${d.PRODUCTO} (${d.CODIGO})`).join('\n')
          : '✅ Todos los productos tienen rotación.';
        break;
      }

   

  
    }

    delete estadoConversacion[from];
    return resultado;
  }

  if (msg.includes("morce") ) {
    estadoConversacion[from] = { paso: 'esperando_opcion' };
    return `📊 ¿Qué querés consultar?\n\n` +
      `1️⃣ Productos próximos a vencer (picking)\n` +
      `2️⃣ Productos con mayor stock en paletas\n` +
      `3️⃣ Productos con rotación negativa\n` +
      `4️⃣ Productos con mayor stock total\n` +
      `5️⃣ Productos vencidos\n` +
      `6️⃣ Productos sin rotación\n` +
     
      
      `Escribí un número del 1 al 9:`;
  }

  return null;
};

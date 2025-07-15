// flows/pdv.js
const Venta = require('../models/ventas');
const Logistica = require('../models/logistica');

function formatearCoordenada(cruda) {
  let coordStr = String(cruda).replace(/[\\,\\s]/g, '');
  if (!coordStr.startsWith('-')) coordStr = '+' + coordStr;
  const signo = coordStr.startsWith('-') ? '-' : '';
  const soloNumeros = coordStr.replace('-', '').replace('+', '');
  const parteEntera = soloNumeros.slice(0, 2);
  const parteDecimal = soloNumeros.slice(2);
  return `${signo}${parteEntera}.${parteDecimal}`.slice(0, parteEntera.length + 1 + 6);
}

module.exports = async function flujoPDV(incomingMsg, from, estadoUsuario) {
  const mensaje = incomingMsg.toLowerCase();

  if (mensaje.includes("pdv")) {
    const matchPdv = mensaje.match(/pdv\s*(\d+)/i);
    if (matchPdv) {
      const pdvBuscado = matchPdv[1];
      estadoUsuario[from] = pdvBuscado;
      return '¿Querés saber información para *ventas* o *logística*?';
    }
    return 'Por favor indicá un PDV, por ejemplo: "Dame información del PDV 12".';
  }

  if (estadoUsuario[from]) {
    const pdvSolicitado = parseInt(estadoUsuario[from]);
    let encontrado = null;

    if (mensaje.includes("ventas")) {
      encontrado = await Venta.findOne({ pdv: pdvSolicitado });
    } else if (mensaje.includes("logistica") || mensaje.includes("logística")) {
      encontrado = await Logistica.findOne({ pdv: pdvSolicitado });
    } else {
      return 'Por favor respondé *ventas* o *logística*.';
    }

    delete estadoUsuario[from];

    if (!encontrado) return `No se encontró información para el PDV ${pdvSolicitado}.`;

   if (mensaje.includes("ventas")) {
  return `PDV ${pdvSolicitado} Ventas:
- Razón Social: ${encontrado.razon || 'N/D'}
- Promotor: ${encontrado.promotor || 'N/D'}
- CANJES: ${encontrado.CANJES || 'N/D'}
- PUNTOS: ${encontrado.PUNTOS || 'N/D'}
- CUPONES B2O: ${encontrado.CUPONES || 'N/D'}
- DESAFIOS: ${encontrado.DESAFIOS || 'N/D'}
- CCC TOTAL: ${encontrado.ccc || 'N/D'}
- CCC CERVEZA: ${encontrado.cvz || 'N/D'}
- CCC UNG: ${encontrado.ung || 'N/D'}
- CCC MKT: ${encontrado.mkt || 'N/D'}
- GESTIÓN CARTERA MKT: ${encontrado.gestion || 'N/D'}
- NIVEL DE DIGITALIZACIÓN: ${encontrado.digitalizacion || 'N/D'}
- VMO CERVEZA: ${
    !isNaN(parseFloat(encontrado.vmocer))
      ? (parseFloat(encontrado.vmocer) * 100).toFixed(2) + '%'
      : (encontrado.vmocer || 'N/D')
  }
- VMO UNG: ${
    !isNaN(parseFloat(encontrado.vmoung))
      ? (parseFloat(encontrado.vmoung) * 100).toFixed(2) + '%'
      : (encontrado.vmoung || 'N/D')
  }
  
  tareas : https://tareascreaciondevalor.onrender.com/`;
}
 else {
      const lon = formatearCoordenada(encontrado.x);
      const lat = formatearCoordenada(encontrado.y);
      const maps = lon && lat ? `https://www.google.com/maps/place/${lat},${lon}` : 'N/D';

      return `PDV ${pdvSolicitado} Logística:
- Razón Social: ${encontrado.razon || 'N/D'}
- Ventana: ${encontrado.ventana || 'N/D'}
- Método: ${encontrado.metodo || 'N/D'}
- Promotor: ${encontrado.promotor || 'N/D'}
- Teléfono cliente: ${encontrado.telefono || 'N/D'}
- Dirección: ${encontrado.direccion || 'N/D'}
- Maps: ${maps}`;
    }
  }

  return null;
};

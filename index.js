require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// Esquemas genéricos
const ventasSchema = new mongoose.Schema({}, { strict: false });
const logisticaSchema = new mongoose.Schema({}, { strict: false });

const Venta = mongoose.model('Venta', ventasSchema, 'ventas');
const Logistica = mongoose.model('Logistica', logisticaSchema, 'logistica');

// Estado temporal por número
const estadoUsuario = {};

app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body?.toLowerCase().trim();
  const from = req.body.From;
  let respuestaFinal = '';
  function formatearCoordenada(cruda) {
    let coordStr = String(cruda).replace(/[,\s]/g, ''); // Quitar comas y espacios
    if (!coordStr.startsWith('-')) coordStr = '+' + coordStr;

    const signo = coordStr.startsWith('-') ? '-' : '';
    const soloNumeros = coordStr.replace('-', '').replace('+', '');

    const parteEntera = soloNumeros.slice(0, 2); // Primeros 2 dígitos
    const parteDecimal = soloNumeros.slice(2);   // El resto

    // Devuelve solo 6 decimales
    return `${signo}${parteEntera}.${parteDecimal}`.slice(0, parteEntera.length + 1 + 6);
  }


  console.log(`📨 Mensaje recibido de ${from}: ${incomingMsg}`);
  console.log('📦 Estado actual:', estadoUsuario);

  if (estadoUsuario[from]) {
    const pdvSolicitado = parseInt(estadoUsuario[from]);
    console.log(`🔍 Buscando información para el PDV: ${pdvSolicitado}`);

    let encontrado = null;

    try {
      if (incomingMsg.includes("ventas")) {
        console.log('📊 Buscando en colección: ventas');
        encontrado = await Venta.findOne({ pdv: pdvSolicitado });
      } else if (incomingMsg.includes("logistica") || incomingMsg.includes("logística")) {
        console.log('🚚 Buscando en colección: logistica');
        encontrado = await Logistica.findOne({ pdv: pdvSolicitado });
      }

      console.log('🧾 Documento encontrado:', encontrado);

      if (encontrado) {
        if (incomingMsg.includes("ventas")) {
          respuestaFinal = `Información del PDV ${pdvSolicitado} (Ventas):
- Razón Social: ${encontrado.razon || 'N/D'}
- Promotor: ${encontrado.promotor || 'N/D'}
- CANJES: ${encontrado.CANJES || 'N/D'}
- PUNTOS : ${encontrado.PUNTOS || 'N/D'}
- CUPONES B2O: ${encontrado.CUPONES || 'N/D'}
- DESAFIOS: ${encontrado.DESAFIOS || 'N/D'}
- CCC TOTAL: ${encontrado.ccc || 'N/D'}
- CCC CERVEZA: ${encontrado.cvz || 'N/D'}
- CCC UNG: ${encontrado.ung || 'N/D'}
- CCC MKT: ${encontrado.mkt || 'N/D'}
- GESTION CARTERA MKT: ${encontrado.gestion || 'N/D'}
- NIVEL DE DIGITALIZACION: ${encontrado.digitalizacion || 'N/D'}
- VMO CERVEZA: ${!isNaN(parseFloat(encontrado.vmocer)) && isFinite(encontrado.vmocer) ? (parseFloat(encontrado.vmocer) * 100).toFixed(2) + '%' : encontrado.vmocer}
- VMO UNG: ${!isNaN(parseFloat(encontrado.vmoung)) && isFinite(encontrado.vmoung) ? (parseFloat(encontrado.vmoung) * 100).toFixed(2) + '%' : encontrado.vmoung}


-PARA VER EL BRAND DISTRIBUTION INGRESA A :
https://sku-0irz.onrender.com/

-PARA VER LAS TAREAS INGRESA A :
https://tareascreaciondevalor.onrender.com/`;
        } else {
          let coordX = encontrado.x || 'N/D';
          let coordY = encontrado.y || 'N/D';
          let enlaceMaps = 'N/D';

          if (coordX !== 'N/D' && coordY !== 'N/D') {
            const lon = formatearCoordenada(coordX);
            const lat = formatearCoordenada(coordY);

            enlaceMaps = `https://www.google.com/maps/place/${lat},${lon}`;
            console.log('🗺️ Enlace generado por coordenadas:', enlaceMaps);
          } else if (encontrado.direccion) {
            const direccionEncoded = encodeURIComponent(encontrado.direccion);
            enlaceMaps = `https://www.google.com/maps/place/${direccionEncoded}`;
            console.log('🗺️ Enlace generado por dirección:', enlaceMaps);
          } else {
            console.log('❌ No hay coordenadas ni dirección válida');
          }

          respuestaFinal = `Información del PDV ${pdvSolicitado} (Logística):
- Razón Social: ${encontrado.razon || 'N/D'}
- Ventana: ${encontrado.ventana || 'N/D'}
- Dirección: ${encontrado.direccion || 'N/D'}
- Método: ${encontrado.metodo || 'N/D'}
- Promotor: ${encontrado.promotor || 'N/D'}
- Teléfono cliente: ${encontrado.telefono || 'N/D'}
- Ubicación: ${enlaceMaps}`;
        }
      } else {
        console.log('⚠️ No se encontró el PDV en la colección.');
        respuestaFinal = `No se encontró información para el PDV ${pdvSolicitado}.`;
      }

      delete estadoUsuario[from];

    } catch (error) {
      console.error('❌ Error al buscar en MongoDB:', error);
      respuestaFinal = 'Error al obtener los datos. Intente nuevamente más tarde.';
    }

  } else {
    if (!incomingMsg.includes("pdv")) {
      respuestaFinal = 'Este número no es para reclamos. Comuníquese con su promotor o con Elsa Boot: +5491166784173';
    } else {
      const matchPdv = incomingMsg.match(/pdv\s*(\d+)/);
      if (matchPdv) {
        const pdvBuscado = matchPdv[1];
        estadoUsuario[from] = pdvBuscado;
        console.log(`🆕 Estado actualizado para ${from}: PDV ${pdvBuscado}`);
        respuestaFinal = '¿Usted quiere saber información para el área de *ventas* o *logística*?';
      } else {
        respuestaFinal = 'Por favor indicá un PDV, por ejemplo: "Dame información del PDV 12".';
      }
    }
  }

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${respuestaFinal.trim()}</Message></Response>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
});

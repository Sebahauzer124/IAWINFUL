require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const moment = require('moment');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

const ventasSchema = new mongoose.Schema({}, { strict: false });
const logisticaSchema = new mongoose.Schema({}, { strict: false });
const morceSchema = new mongoose.Schema({}, { strict: false });
const censoSchema = new mongoose.Schema({}, { strict: false });



const Venta = mongoose.model('Venta', ventasSchema, 'ventas');
const Logistica = mongoose.model('Logistica', logisticaSchema, 'logistica');
const Morce = mongoose.model('Morce', morceSchema, 'morce');
const censo = mongoose.model('Censo', censoSchema, 'censo');

const estadoUsuario = {}; // PDV
const estadoConversacion = {}; // Morce y Censo

function formatearCoordenada(cruda) {
  let coordStr = String(cruda).replace(/[\,\s]/g, '');
  if (!coordStr.startsWith('-')) coordStr = '+' + coordStr;
  const signo = coordStr.startsWith('-') ? '-' : '';
  const soloNumeros = coordStr.replace('-', '').replace('+', '');
  const parteEntera = soloNumeros.slice(0, 2);
  const parteDecimal = soloNumeros.slice(2);
  return `${signo}${parteEntera}.${parteDecimal}`.slice(0, parteEntera.length + 1 + 6);
}

function getTopN(obj, n = 5) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
}

app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body?.toLowerCase().trim();
  const from = req.body.From;
  let respuestaFinal = '';
  console.log(`📨 Mensaje recibido de ${from}: ${incomingMsg}`);

  try {
    function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

if (incomingMsg.toLowerCase() === 'censo') {
  estadoConversacion[from] = { paso: 'censo_esperando_canal' };
  respuestaFinal = '¿Sobre qué *canal* querés saber?';
  console.log(`[${from}] Inicio de conversación CENSO, pido canal`);
}

else if (estadoConversacion[from]?.paso === 'censo_esperando_canal') {
  estadoConversacion[from].canal = incomingMsg.toUpperCase().trim();
  estadoConversacion[from].paso = 'censo_esperando_tipo_filtro';
  respuestaFinal = '¿Querés saber por *localidad* o por *vendedor*?';
  console.log(`[${from}] Canal recibido: ${estadoConversacion[from].canal}, pido tipo filtro`);
}

else if (estadoConversacion[from]?.paso === 'censo_esperando_tipo_filtro') {
  const eleccion = incomingMsg.toLowerCase().trim();
  console.log(`[${from}] Tipo de filtro recibido: ${eleccion}`);

  if (eleccion === 'localidad') {
    estadoConversacion[from].paso = 'censo_esperando_localidad';
    respuestaFinal = 'Indicá la *localidad* que querés analizar:';
  } else if (eleccion === 'vendedor') {
    estadoConversacion[from].paso = 'censo_esperando_vendedor';
    respuestaFinal = 'Indicá el *nombre del vendedor* que querés analizar:';
  } else {
    respuestaFinal = 'Por favor respondé *localidad* o *vendedor*';
  }
}

else if (estadoConversacion[from]?.paso === 'censo_esperando_localidad') {
  estadoConversacion[from].localidad = incomingMsg.trim();
  estadoConversacion[from].paso = 'censo_esperando_tipo';
  respuestaFinal = '¿Querés saber dónde *crecemos* o dónde *caemos*?';
  console.log(`[${from}] Localidad recibida: ${estadoConversacion[from].localidad}, pido tipo de análisis`);
}

else if (estadoConversacion[from]?.paso === 'censo_esperando_vendedor') {
  estadoConversacion[from].vendedor = incomingMsg.trim();
  estadoConversacion[from].paso = 'censo_esperando_tipo_vendedor';
  respuestaFinal = '¿Querés saber dónde *crecemos* o dónde *caemos*?';
  console.log(`[${from}] Vendedor recibido: ${estadoConversacion[from].vendedor}, pido tipo de análisis`);
}

else if (
  estadoConversacion[from]?.paso === 'censo_esperando_tipo' ||
  estadoConversacion[from]?.paso === 'censo_esperando_tipo_vendedor'
) {
  const tipo = incomingMsg.toLowerCase().trim();
  const esPorLocalidad = estadoConversacion[from].paso === 'censo_esperando_tipo';
  const filtro = esPorLocalidad ? 'LOCALIDAD' : 'vendedor';
  const valorFiltro = estadoConversacion[from][esPorLocalidad ? 'localidad' : 'vendedor'];
  const canalFiltro = estadoConversacion[from].canal || '';
  const valorNormalizado = normalizarTexto(valorFiltro.toString());

  console.log(`[${from}] Tipo análisis recibido: ${tipo}`);
  console.log(`[${from}] Buscando en filtro: ${filtro} valor: ${valorFiltro} (normalizado: ${valorNormalizado}) canal: ${canalFiltro}`);

  if (tipo !== 'crecemos' && tipo !== 'caemos') {
    respuestaFinal = 'Por favor respondé *crecemos* o *caemos*.';
    console.log(`[${from}] Tipo de análisis inválido`);
  } else {
    try {
      // Obtengo valores únicos del filtro para el canal dado
      const valoresDB = await censo.distinct(filtro, { 'canal': canalFiltro });
      console.log(`[${from}] Valores únicos encontrados para filtro "${filtro}":`, valoresDB);

      // Busco coincidencia exacta normalizada
      const coincidencia = valoresDB.find(v => normalizarTexto(v.toString()) === valorNormalizado);

      if (!coincidencia) {
        const sugerencias = valoresDB
          .filter(v => normalizarTexto(v.toString()).includes(valorNormalizado.slice(0, 4)))
          .slice(0, 5);
        respuestaFinal =
          `⚠️ No encontré datos para ${esPorLocalidad ? 'la localidad' : 'el vendedor'} "${valorFiltro}" en el canal "${canalFiltro}".\n\n¿Quisiste decir alguna de estas?\n\n` +
          sugerencias.join('\n');
        console.log(`[${from}] No se encontró coincidencia exacta. Sugerencias:`, sugerencias);
      } else {
        const datos = await censo.find({ [filtro]: coincidencia, 'canal': canalFiltro });
        console.log(`[${from}] Documentos encontrados: ${datos.length}`);

        if (datos.length === 0) {
          respuestaFinal = `No encontré datos para ${esPorLocalidad ? 'la localidad' : 'el vendedor'} "${valorFiltro}" en el canal "${canalFiltro}".`;
        } else {
          const puntos = datos.filter(d => parseFloat(d["volumen 2024"]) > 0);
          console.log(`[${from}] Puntos con volumen 2024 > 0: ${puntos.length}`);

          if (puntos.length === 0) {
            respuestaFinal = `No hay puntos con volumen 2024 mayor a 0 en "${valorFiltro}" para el canal "${canalFiltro}".`;
          } else {
            let diffs = puntos.map(d => {
              const vol2024 = parseFloat(d["volumen 2024"]) || 0;
              const vol2025 = parseFloat(d["volumen 2025"]) || 0;
              const diferencia = vol2025 - vol2024;

              const lon = d.x ? (parseFloat(d.x) / 1e6).toFixed(6) : null;
              const lat = d.y ? (parseFloat(d.y) / 1e6).toFixed(6) : null;
              const maps = lon && lat ? `https://www.google.com/maps/place/${lat},${lon}` : 'N/D';

              const ccu = (parseFloat(d["CCU abril25"]) || 0).toFixed(1);
              const cmq = (parseFloat(d["CMQ abril25"]) || 0).toFixed(1);
              const otros = (parseFloat(d["OTROS abril25"]) || 0).toFixed(1);

              const share = d["SHARE CMQ"] ? (parseFloat(d["SHARE CMQ"]) * 100).toFixed(2) + '%' : '0.00%';
              const sharesep24 = d["SHARE CMQ sep24"] ? (parseFloat(d["SHARE CMQ sep24"]) * 100).toFixed(2) + '%' : '0.00%';
              const shareabril24 = d["SHARE CMQ abril24"] ? (parseFloat(d["SHARE CMQ abril24"]) * 100).toFixed(2) + '%' : '0.00%';

              return {
                pdv: d.pdv || d.cliente || d["razon"] || 'Sin nombre',
                diferencia,
                maps,
                ccu,
                cmq,
                otros,
                share,
                sharesep24,
                shareabril24
              };
            });

            if (tipo === 'caemos') {
              diffs = diffs.filter(d => d.diferencia < 0).sort((a, b) => a.diferencia - b.diferencia);
            } else {
              diffs = diffs.filter(d => d.diferencia > 0).sort((a, b) => b.diferencia - a.diferencia);
            }

            if (diffs.length === 0) {
              respuestaFinal = `No se encontraron puntos que ${tipo} en "${valorFiltro}" para el canal "${canalFiltro}".`;
            } else {
              const top5 = diffs.slice(0, 5);
              respuestaFinal =
                `📊 Top 5 puntos donde ${tipo} en "${valorFiltro}" (Canal: ${canalFiltro}):\n\n` +
                top5.map(p =>
                  `• ${p.pdv}\n` +
                  `  ↪ Diferencia: ${p.diferencia.toFixed(2)} hL\n` +
                  `  ↪ Ubicación: ${p.maps}\n` +
                  `  ↪ CCU [hL]: ${p.ccu}\n` +
                  `  ↪ CMQ [hL]: ${p.cmq}\n` +
                  `  ↪ OTROS [hL]: ${p.otros}\n` +
                  `  ↪ SHARE CMQ: ${p.share}\n` +
                  `  ↪ SHARE CMQ vs sep24: ${p.sharesep24}\n` +
                  `  ↪ SHARE CMQ vs abril24: ${p.shareabril24}`
                ).join('\n\n');
            }
          }
        }
      }
    } catch (error) {
      console.error(`[${from}] Error en búsqueda de datos:`, error);
      respuestaFinal = '❌ Ocurrió un error al buscar los datos. Intentá más tarde.';
    }
    delete estadoConversacion[from];
  }
}






    // --- FIN FLUJO CENSO ---

    // --- FLUJO MORCE ---
    else if (estadoConversacion[from]?.paso === 'esperando_opcion') {
      const numero = parseInt(incomingMsg);
      if (!(numero >= 1 && numero <= 10)) {
        respuestaFinal = '⚠️ Escribí un número correcto por favor (1 a 10):';
      } else {
        estadoConversacion[from] = { paso: 'esperando_periodo', seleccion: numero };
        respuestaFinal = `📅 Perfecto. Indicá el período que querés consultar, por ejemplo:\n\nde 5-5-2025 al 8-5-2025`;
      }
    }
    else if (estadoConversacion[from]?.paso === 'esperando_periodo') {
      const match = incomingMsg.match(/de\s+(\d{1,2})-(\d{1,2})-(\d{4})\s+al\s+(\d{1,2})-(\d{1,2})-(\d{4})/);
      if (!match) {
        respuestaFinal = '📅 Por favor indicá el período en el formato: de 5-5-2025 al 8-5-2025';
      } else {
        const [, d1, m1, y1, d2, m2, y2] = match;
        const fechaInicio = moment(`${d1.padStart(2, '0')}-${m1.padStart(2, '0')}-${y1}`, 'DD-MM-YYYY');
        const fechaFin = moment(`${d2.padStart(2, '0')}-${m2.padStart(2, '0')}-${y2}`, 'DD-MM-YYYY');
        const seleccion = estadoConversacion[from].seleccion;

        if (!fechaInicio.isValid() || !fechaFin.isValid() || fechaFin.isBefore(fechaInicio)) {
          respuestaFinal = '❌ Fechas inválidas o período incorrecto. Intentá de nuevo.';
        } else {
          const datos = await Morce.find({});
          const filtrados = datos.filter(doc => {
            const fechaDoc = moment(doc.fecha, 'DD-MM-YYYY');
            return fechaDoc.isValid() && fechaDoc.isBetween(fechaInicio, fechaFin, undefined, '[]');
          });

          if (filtrados.length === 0) {
            respuestaFinal = 'No se encontraron datos en el período indicado.';
          } else {

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
            }

            if (!respuestaFinal) respuestaFinal = resultado || 'No hay datos disponibles.';
          }
        }
        delete estadoConversacion[from];
      }
    }
    else if (incomingMsg.includes("morce")) {
      estadoConversacion[from] = { paso: 'esperando_opcion' };
      respuestaFinal = `¿Qué querés saber?\n\n1️⃣ Cliente que más rechaza\n2️⃣ Cliente que más compra\n3️⃣ Vendedor que más vende\n4️⃣ SKU que más se facturó\n5️⃣ Segmento con más ventas\n6️⃣ Día con más ventas\n7️⃣ SKU con más devoluciones\n8️⃣ Vendedor con más devoluciones\n9️⃣ Cliente con más facturación\n`;
    }
    // --- FIN FLUJO MORCE ---


    else if (incomingMsg.includes("pdv")) {
      const matchPdv = incomingMsg.match(/pdv\s*(\d+)/);
      if (matchPdv) {
        const pdvBuscado = matchPdv[1];
        estadoUsuario[from] = pdvBuscado;
        respuestaFinal = '¿Usted quiere saber información para el área de *ventas* o *logística*?';
      } else {
        respuestaFinal = 'Por favor indicá un PDV, por ejemplo: "Dame información del PDV 12".';
      }
    }
    else if (estadoUsuario[from]) {
      const pdvSolicitado = parseInt(estadoUsuario[from]);
      let encontrado = null;
      if (incomingMsg.includes("ventas")) encontrado = await Venta.findOne({ pdv: pdvSolicitado });
      else if (incomingMsg.includes("logistica") || incomingMsg.includes("logística")) encontrado = await Logistica.findOne({ pdv: pdvSolicitado });

      if (encontrado) {
        if (incomingMsg.includes("ventas")) {
          respuestaFinal = `PDV ${pdvSolicitado} Ventas:\n- Razón Social: ${encontrado.razon || 'N/D'}\n- Promotor: ${encontrado.promotor || 'N/D'}\n- CANJES: ${encontrado.CANJES || 'N/D'}\n- PUNTOS: ${encontrado.PUNTOS || 'N/D'}\n- CUPONES B2O: ${encontrado.CUPONES || 'N/D'}\n- DESAFIOS: ${encontrado.DESAFIOS || 'N/D'}\n- CCC TOTAL: ${encontrado.ccc || 'N/D'}\n- CCC CERVEZA: ${encontrado.cvz || 'N/D'}\n- CCC UNG: ${encontrado.ung || 'N/D'}\n- CCC MKT: ${encontrado.mkt || 'N/D'}\n- GESTIÓN CARTERA MKT: ${encontrado.gestion || 'N/D'}\n- NIVEL DE DIGITALIZACIÓN: ${encontrado.digitalizacion || 'N/D'}\n- VMO CERVEZA: ${!isNaN(parseFloat(encontrado.vmocer)) ? (parseFloat(encontrado.vmocer) * 100).toFixed(2) + '%' : 'N/D'}\n- VMO UNG: ${!isNaN(parseFloat(encontrado.vmoung)) ? (parseFloat(encontrado.vmoung) * 100).toFixed(2) + '%' : 'N/D'}\n\n- Brand Distribution: https://sku-0irz.onrender.com/\n- Tareas: https://tareascreaciondevalor.onrender.com/`;
        } else {
          const lon = formatearCoordenada(encontrado.x);
          const lat = formatearCoordenada(encontrado.y);
          const maps = lon && lat ? `https://www.google.com/maps/place/${lat},${lon}` : 'N/D';
          respuestaFinal = `PDV ${pdvSolicitado} Logística:\n- Razón Social: ${encontrado.razon || 'N/D'}\n- Ventana: ${encontrado.ventana || 'N/D'}\n- Método: ${encontrado.metodo || 'N/D'}\n- Promotor: ${encontrado.promotor || 'N/D'}\n- Teléfono cliente: ${encontrado.telefono || 'N/D'}\n- Dirección: ${encontrado.direccion || 'N/D'}\n- Maps: ${maps}`;
        }
      } else {
        respuestaFinal = `No se encontró información para el PDV ${pdvSolicitado}.`;
      }
      delete estadoUsuario[from];
    }
    else {
      respuestaFinal = 'Este número no es para reclamos. Comuníquese con su promotor o con Elsa Boot: +5491166784173';
    }
  } catch (error) {
    console.error('❌ Error general:', error);
    respuestaFinal = '❌ Ocurrió un error inesperado. Intentá más tarde.';
    delete estadoConversacion[from];
    delete estadoUsuario[from];
  }

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${respuestaFinal.trim()}</Message></Response>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
});

const censo = require('../models/censo');

// Función para normalizar texto (elimina tildes y pasa a minúsculas)
const normalizarTexto = texto =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

module.exports = async function flujoCenso(incomingMsg, from, estadoConversacion) {
  const msg = incomingMsg.toLowerCase().trim();
  let respuestaFinal = '';

  // Paso inicial
  if (msg === 'censo') {
    estadoConversacion[from] = { paso: 'censo_esperando_tipo_inicio' };
    return '¿Querés saber sobre un *canal* o sobre un *PDV específico*?';
  }

  const estado = estadoConversacion[from];
  if (!estado || typeof estado.paso !== 'string' || !estado.paso.startsWith('censo')) return null;

  switch (estado.paso) {
    // Elección entre canal o PDV
    case 'censo_esperando_tipo_inicio':
      if (msg === 'canal') {
        estado.paso = 'censo_esperando_canal';
        return '¿Sobre qué *canal* querés saber?';
      } else if (msg === 'pdv') {
        estado.paso = 'censo_esperando_codigo_pdv';
        return '📌 Indicá el *código de PDV* que querés consultar:';
      } else {
        return '⚠️ Por favor escribí *canal* o *pdv*';
      }

    // Consulta de PDV por código
    case 'censo_esperando_codigo_pdv': {
      const codigoPDV = parseInt(msg);
      if (isNaN(codigoPDV)) return '⚠️ El código debe ser un número. Intentá de nuevo.';

      const doc = await censo.findOne({ codigo: codigoPDV });
      if (!doc) return `❌ No encontré datos para el PDV con código ${codigoPDV}. Verificá el número.`;

      const vol2024 = parseFloat(doc["volumen 2024"]) || 0;
      const vol2025 = parseFloat(doc["volumen 2025"]) || 0;
      const diferencia = vol2025 - vol2024;

      const lon = doc.x ? (parseFloat(doc.x) / 1e6).toFixed(6) : null;
      const lat = doc.y ? (parseFloat(doc.y) / 1e6).toFixed(6) : null;
      const maps = lon && lat ? `https://www.google.com/maps/place/${lat},${lon}` : 'N/D';

      const ccu = (parseFloat(doc["CCU abril25"]) || 0).toFixed(1);
      const cmq = (parseFloat(doc["CMQ abril25"]) || 0).toFixed(1);
      const otros = (parseFloat(doc["OTROS abril25"]) || 0).toFixed(1);

      const share = doc["SHARE CMQ"] ? (parseFloat(doc["SHARE CMQ"]) * 100).toFixed(2) + '%' : '0.00%';
      const shareSep24 = doc["SHARE CMQ sep24"] ? (parseFloat(doc["SHARE CMQ sep24"]) * 100).toFixed(2) + '%' : '0.00%';
      const shareAbril24 = doc["SHARE CMQ abril24"] ? (parseFloat(doc["SHARE CMQ abril24"]) * 100).toFixed(2) + '%' : '0.00%';
      const vendedor= doc.vendedor || 'Desconocido';
      const localidad = doc.LOCALIDAD || 'Desconocida';

      respuestaFinal = `📊 Datos del PDV ${codigoPDV} - ${doc.razon || 'Sin nombre'}:

↪ Diferencia: ${diferencia.toFixed(2)} hL
↪ Maps: ${maps}
↪ CCU abril25: ${ccu}
↪ CMQ abril25: ${cmq}
↪ Otros abril25: ${otros}
↪ SHARE CMQ: ${share}
↪ SHARE vs sep24: ${shareSep24}
↪ SHARE vs abril24: ${shareAbril24}
↪ Vendedor: ${vendedor}
↪ Localidad: ${localidad}`;

      delete estadoConversacion[from];
      return respuestaFinal;
    }

    // Flujo para canal
    case 'censo_esperando_canal':
      estado.canal = incomingMsg.toUpperCase().trim();
      estado.paso = 'censo_esperando_tipo_filtro';
      return '¿Querés saber por *localidad* o por *vendedor*?';

    case 'censo_esperando_tipo_filtro':
      if (msg === 'localidad') {
        estado.paso = 'censo_esperando_localidad';
        return 'Indicá la *localidad* que querés analizar:';
      } else if (msg === 'vendedor') {
        estado.paso = 'censo_esperando_vendedor';
        return 'Indicá el *nombre del vendedor* que querés analizar:';
      } else {
        return '⚠️ Por favor respondé *localidad* o *vendedor*';
      }

    // Guardamos el valor de localidad o vendedor
    case 'censo_esperando_localidad':
    case 'censo_esperando_vendedor': {
      const clave = estado.paso === 'censo_esperando_localidad' ? 'localidad' : 'vendedor';
      estado[clave] = incomingMsg.trim();
      estado.paso = `censo_esperando_tipo_${clave}`;
      return '¿Querés saber dónde *crecemos* o dónde *caemos*?';
    }

    // Procesamos el análisis de crecimiento o caída
    case 'censo_esperando_tipo_localidad':
    case 'censo_esperando_tipo_vendedor': {
      if (msg !== 'crecemos' && msg !== 'caemos') {
        return '⚠️ Por favor respondé *crecemos* o *caemos*';
      }

      const tipo = msg;
      const esPorLocalidad = estado.paso.includes('localidad');
      const filtro = esPorLocalidad ? 'LOCALIDAD' : 'vendedor';
      const valorFiltro = estado[esPorLocalidad ? 'localidad' : 'vendedor'];
      const canalFiltro = estado.canal;
      const valorNormalizado = normalizarTexto(valorFiltro);

      const valoresDB = await censo.distinct(filtro, { canal: canalFiltro });
      const coincidencia = valoresDB.find(v => normalizarTexto(v.toString()) === valorNormalizado);

      if (!coincidencia) {
        const sugerencias = valoresDB
          .filter(v => normalizarTexto(v.toString()).includes(valorNormalizado.slice(0, 4)))
          .slice(0, 5);
        return `⚠️ No encontré datos para "${valorFiltro}" en el canal "${canalFiltro}". ¿Quisiste decir alguna de estas?\n\n${sugerencias.join('\n')}`;
      }

      const datos = await censo.find({ [filtro]: coincidencia, canal: canalFiltro });
      const puntos = datos.filter(d => parseFloat(d['volumen 2024']) > 0);

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
        const shareSep24 = d["SHARE CMQ sep24"] ? (parseFloat(d["SHARE CMQ sep24"]) * 100).toFixed(2) + '%' : '0.00%';
        const shareAbril24 = d["SHARE CMQ abril24"] ? (parseFloat(d["SHARE CMQ abril24"]) * 100).toFixed(2) + '%' : '0.00%';

        return {
          pdv: d.pdv || d.cliente || d.razon || 'Sin nombre',
          diferencia,
          maps,
          ccu,
          cmq,
          otros,
          share,
          shareSep24,
          shareAbril24
        };
      });

      diffs = tipo === 'crecemos'
        ? diffs.filter(d => d.diferencia > 0).sort((a, b) => b.diferencia - a.diferencia)
        : diffs.filter(d => d.diferencia < 0).sort((a, b) => a.diferencia - b.diferencia);

      if (diffs.length === 0) {
        delete estadoConversacion[from];
        return `❌ No se encontraron puntos que ${tipo} en "${valorFiltro}" para el canal "${canalFiltro}".`;
      }

      const top5 = diffs.slice(0, 5);
      respuestaFinal = `📊 Top 5 puntos donde ${tipo} en "${valorFiltro}" (Canal: ${canalFiltro}):\n\n` +
        top5.map(p =>
          `• ${p.pdv}
  ↪ Diferencia: ${p.diferencia.toFixed(2)} hL
  ↪ Maps: ${p.maps}
  ↪ CCU abril25: ${p.ccu}
  ↪ CMQ abril25: ${p.cmq}
  ↪ Otros abril25: ${p.otros}
  ↪ SHARE CMQ: ${p.share}
  ↪ SHARE vs sep24: ${p.shareSep24}
  ↪ SHARE vs abril24: ${p.shareAbril24}`
        ).join('\n\n');

      delete estadoConversacion[from];
      return respuestaFinal;
    }

    default:
      return null;
  }
};

const censo = require('../models/censo');

const normalizarTexto = texto =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

module.exports = async function flujoCenso(incomingMsg, from, estadoConversacion) {
  const msg = incomingMsg.trim().toLowerCase();
  let respuestaFinal = '';

  if (msg === 'salidas al mercado') {
    estadoConversacion[from] = { paso: 'censo_esperando_tipo_inicio' };
    return "¿Querés saber sobre un *canal* o sobre un *PDV específico*?\n\n1️⃣ Canal\n2️⃣ PDV";
  }

  const estado = estadoConversacion[from];
  if (!estado || typeof estado.paso !== 'string' || !estado.paso.startsWith('censo')) return null;

  switch (estado.paso) {

    case 'censo_esperando_tipo_inicio': {
      if (msg === '1' || msg === 'canal') {
        const canales = await censo.distinct('canal');
        estado.paso = 'censo_esperando_canal';
        estado.canales = canales;
        return "📋 Seleccioná un canal:\n" + canales.map((c, i) => `⚪ ${i + 1} - ${c}`).join("\n");
      } else if (msg === '2' || msg === 'pdv') {
        estado.paso = 'censo_esperando_codigo_pdv';
        return '📌 Indicá el *código de PDV* que querés consultar:';
      } else {
        return '⚠️ Respuesta no válida. Escribí 1 para *Canal* o 2 para *PDV*.';
      }
    }

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

      delete estadoConversacion[from];
      return `📊 Datos del PDV ${codigoPDV} - ${doc.razon || 'Sin nombre'}:

↪ Diferencia: ${diferencia.toFixed(2)} hL
↪ Maps: ${maps}
↪ CCU abril25: ${ccu}
↪ CMQ abril25: ${cmq}
↪ Otros abril25: ${otros}
↪ SHARE CMQ: ${share}
↪ SHARE vs sep24: ${shareSep24}
↪ SHARE vs abril24: ${shareAbril24}
↪ Vendedor: ${doc.vendedor || 'Desconocido'}
↪ Localidad: ${doc.LOCALIDAD || 'Desconocida'}`;
    }

    case 'censo_esperando_canal': {
      const index = parseInt(msg) - 1;
      if (isNaN(index) || index < 0 || index >= estado.canales.length) {
        return '⚠️ Opción inválida. Elegí un número de la lista.';
      }
      const canalSeleccionado = estado.canales[index];
      estado.canal = canalSeleccionado;

      const vendedores = await censo.distinct('vendedor', { canal: canalSeleccionado });
      estado.vendedores = vendedores;
      estado.paso = 'censo_esperando_vendedor';
      return `📋 Vendedores en canal "${canalSeleccionado}":\n` +
        vendedores.map((v, i) => `⚪ ${i + 1} - ${v}`).join("\n");
    }

    case 'censo_esperando_vendedor': {
      const index = parseInt(msg) - 1;
      if (isNaN(index) || index < 0 || index >= estado.vendedores.length) {
        return '⚠️ Opción inválida. Elegí un número de la lista.';
      }
      const vendedorSeleccionado = estado.vendedores[index];
      estado.vendedor = vendedorSeleccionado;

      const localidades = await censo.distinct('LOCALIDAD', {
        canal: estado.canal,
        vendedor: vendedorSeleccionado
      });
      estado.localidades = localidades;
      estado.paso = 'censo_esperando_localidad';
      return `📋 Localidades para vendedor "${vendedorSeleccionado}":\n` +
        localidades.map((l, i) => `⚪ ${i + 1} - ${l}`).join("\n");
    }

    case 'censo_esperando_localidad': {
      const index = parseInt(msg) - 1;
      if (isNaN(index) || index < 0 || index >= estado.localidades.length) {
        return '⚠️ Opción inválida. Elegí un número de la lista.';
      }
      estado.localidad = estado.localidades[index];
      estado.paso = 'censo_esperando_tipo_analisis';
      return "¿Querés saber dónde *crecemos* o dónde *caemos*?\n\n1️⃣ Crecemos\n2️⃣ Caemos";
    }

    case 'censo_esperando_tipo_analisis': {
      const tipo = (msg === '1' || msg.includes('crecemos')) ? 'crecemos' : 'caemos';

      const datos = await censo.find({
        canal: estado.canal,
        LOCALIDAD: estado.localidad,
        vendedor: estado.vendedor
      });

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
        return `❌ No se encontraron puntos que ${tipo} en la localidad "${estado.localidad}" y vendedor "${estado.vendedor}" para el canal "${estado.canal}".`;
      }

      const top5 = diffs.slice(0, 5);
      const respuesta = `📊 Top 5 puntos donde ${tipo} en "${estado.localidad}" con promotor "${estado.vendedor}" (Canal: ${estado.canal}):\n\n` +
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
      return respuesta;
    }

    default:
      return null;
  }
};

// utils/helpers.js
function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

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

module.exports = { normalizarTexto, formatearCoordenada, getTopN };

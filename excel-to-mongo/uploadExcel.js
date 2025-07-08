const { MongoClient } = require('mongodb');
const xlsx = require('xlsx');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGO_URI;

function convertirFechaExcel(fechaSerial) {
  const fecha = new Date((fechaSerial - 25569) * 86400 * 1000);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = fecha.getFullYear();
  return `${dia}-${mes}-${anio}`;
}

async function subirExcelAMongo() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('twilio');

    const ventasCollection = db.collection('ventas');
    const logisticaCollection = db.collection('logistica');
    const hoja7Collection = db.collection('morce');
    const censoCollection = db.collection('censo');
    const ventasSkuCollection = db.collection('ventassku'); // 🔹 NUEVO
    const stockCollection = db.collection('stocks');        // 🔹 NUEVO

    const filePath = path.join(process.cwd(), 'compromisoBEES.xlsx');
    const workbook = xlsx.readFile(filePath);

    const hojaVentas = xlsx.utils.sheet_to_json(workbook.Sheets['Hoja1']);
    const hojaLogistica = xlsx.utils.sheet_to_json(workbook.Sheets['Hoja2']);
    const hoja7Raw = xlsx.utils.sheet_to_json(workbook.Sheets['Hoja7'], { defval: null });
    const hoja9 = xlsx.utils.sheet_to_json(workbook.Sheets['Hoja9'], { defval: null });
    const hoja17 = xlsx.utils.sheet_to_json(workbook.Sheets['Hoja17'], { defval: null }); // 🔹
    const hoja18 = xlsx.utils.sheet_to_json(workbook.Sheets['Hoja18'], { defval: null }); // 🔹

    const hoja7 = hoja7Raw.map((fila) => {
      const nuevaFila = { ...fila };
      if (nuevaFila['fecha'] && typeof nuevaFila['fecha'] === 'number') {
        nuevaFila['fecha'] = convertirFechaExcel(nuevaFila['fecha']);
      } else if (nuevaFila['fecha'] instanceof Date) {
        const fecha = nuevaFila['fecha'];
        const dia = String(fecha.getDate()).padStart(2, '0');
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const anio = fecha.getFullYear();
        nuevaFila['fecha'] = `${dia}-${mes}-${anio}`;
      }
      return nuevaFila;
    });

    // 🔄 Borramos las colecciones antes de cargar nuevos datos
    await ventasCollection.deleteMany({});
    await logisticaCollection.deleteMany({});
    await hoja7Collection.deleteMany({});
    await censoCollection.deleteMany({});
    await ventasSkuCollection.deleteMany({}); // 🔹
    await stockCollection.deleteMany({});     // 🔹

    if (hojaVentas.length) {
      await ventasCollection.insertMany(hojaVentas);
      console.log(`✅ Subidos ${hojaVentas.length} documentos a la colección ventas`);
    }

    if (hojaLogistica.length) {
      await logisticaCollection.insertMany(hojaLogistica);
      console.log(`✅ Subidos ${hojaLogistica.length} documentos a la colección logistica`);
    }

    if (hoja7.length) {
      await hoja7Collection.insertMany(hoja7);
      console.log(`✅ Subidos ${hoja7.length} documentos a la colección morce`);
    }

    if (hoja9.length) {
      await censoCollection.insertMany(hoja9);
      console.log(`✅ Subidos ${hoja9.length} documentos a la colección censo`);
    }

    if (hoja17.length) {
      await ventasSkuCollection.insertMany(hoja17); // 🔹
      console.log(`✅ Subidos ${hoja17.length} documentos a la colección ventassku`);
    }

    if (hoja18.length) {
      await stockCollection.insertMany(hoja18); // 🔹
      console.log(`✅ Subidos ${hoja18.length} documentos a la colección stocks`);
    }

    console.log('🚀 Carga finalizada');
  } catch (error) {
    console.error('❌ Error subiendo datos:', error);
  } finally {
    await client.close();
  }
}

subirExcelAMongo();

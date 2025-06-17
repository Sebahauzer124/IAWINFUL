const { MongoClient } = require('mongodb');
const xlsx = require('xlsx');
const path = require('path');

// Pega aquí tu URI de conexión de MongoDB Atlas
const uri = 'mongodb+srv://twilio:twilio@ventas.bdk0kxu.mongodb.net/?retryWrites=true&w=majority&appName=ventas';

async function subirExcelAMongo() {
  const client = new MongoClient(uri);

  try {
    await client.connect();

    const db = client.db('twilio'); // Cambia "nombreBaseDeDatos" por el nombre que quieras

    const ventasCollection = db.collection('ventas');
    const logisticaCollection = db.collection('logistica');

    // Leer archivo Excel
    const filePath = path.join(process.cwd(), 'compromisoBEES.xlsx');
    const workbook = xlsx.readFile(filePath);

    // Convertir hojas a JSON
    const hojaVentas = xlsx.utils.sheet_to_json(workbook.Sheets['Hoja1']);
    const hojaLogistica = xlsx.utils.sheet_to_json(workbook.Sheets['Hoja2']);

    // Vaciar colecciones antes de subir datos (opcional)
    await ventasCollection.deleteMany({});
    await logisticaCollection.deleteMany({});

    // Insertar datos en las colecciones
    if (hojaVentas.length) {
      await ventasCollection.insertMany(hojaVentas);
      console.log(`Subidos ${hojaVentas.length} documentos a la colección ventas`);
    }

    if (hojaLogistica.length) {
      await logisticaCollection.insertMany(hojaLogistica);
      console.log(`Subidos ${hojaLogistica.length} documentos a la colección logistica`);
    }

    console.log('Carga finalizada');

  } catch (error) {
    console.error('Error subiendo datos:', error);
  } finally {
    await client.close();
  }
}

subirExcelAMongo();

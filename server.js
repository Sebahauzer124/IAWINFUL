require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const xlsx = require('xlsx'); // Librería para leer el Excel
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Ruta del archivo Excel
const filePath = "C:\\Users\\Vifood\\Desktop\\Macros\\Trabajando con Twilio\\compromisoBEES.xlsx";

// Leer y cargar los datos del archivo Excel
let respuestasDesdeExcel = [];

function cargarExcel() {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]]; // Obtener la primera hoja
    const data = xlsx.utils.sheet_to_json(sheet); // Convertir a JSON
    respuestasDesdeExcel = data;
    console.log('Excel cargado con éxito:', respuestasDesdeExcel);
  } catch (error) {
    console.error('Error al leer el archivo Excel:', error);
  }
}

// Cargar el archivo Excel una vez cuando inicie el servidor
cargarExcel();

app.post('/webhook', (req, res) => {
  const incomingMsg = req.body.Body?.toLowerCase();
  const from = req.body.From;

  console.log(`Mensaje recibido de ${from}: ${incomingMsg}`);

  let respuestaFinal = '';

  // Buscar si el mensaje contiene "pdv <número>"
  const matchPdv = incomingMsg.match(/pdv\s*(\d+)/);

  if (matchPdv) {
    const pdvBuscado = matchPdv[1];

    // Buscar el registro en el Excel que coincida con ese PDV
    const encontrado = respuestasDesdeExcel.find(item => String(item.pdv) === pdvBuscado);

    if (encontrado) {
      respuestaFinal = `
Información del PDV ${pdvBuscado}:
Razón Social: ${encontrado['razon'] || 'N/D'}:
promotor: ${encontrado['promotor'] || 'N/D'}:
CANJES: ${encontrado['CANJES'] || 'N/D'}:
DESAFIOS: ${encontrado['DESAFIOS'] || 'N/D'}:
CCC MKT: ${encontrado['CCC MKT'] || 'N/D'} 
 

      `;
    } else {
      respuestaFinal = `No se encontró información para el PDV ${pdvBuscado}.`;
    }
  } else {
    respuestaFinal = 'Por favor indicá un PDV, por ejemplo: "Dame información del PDV 12".';
  }

  res.set('Content-Type', 'text/xml');
  res.send(`
    <Response>
      <Message>${respuestaFinal.trim()}</Message>
    </Response>
  `);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});

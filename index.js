require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');  // <-- Agregá mongoose
const app = express();
const whatsappRoute = require('./routes/whatsapp');


app.use(express.json()); 
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/webhook', whatsappRoute);

const PORT = process.env.PORT || 3000;

// Conectarse a MongoDB antes de arrancar el servidor
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Conectado a MongoDB');
  app.listen(PORT, () => {
    console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
  });
})
.catch(err => {
  console.error('❌ Error conectando a MongoDB:', err);
  process.exit(1);  // Salir si no puede conectar
});
//escribo

// services/db.js
const mongoose = require('mongoose');

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
const Censo = mongoose.model('Censo', censoSchema, 'censo');

module.exports = { Venta, Logistica, Morce, Censo };

const mongoose = require('mongoose');

const ventasSchema = new mongoose.Schema({}, { strict: false });

module.exports = mongoose.model('Venta', ventasSchema, 'ventas');

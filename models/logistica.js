const mongoose = require('mongoose');

const logisticaSchema = new mongoose.Schema({}, { strict: false });

module.exports = mongoose.model('Logistica', logisticaSchema, 'logistica');

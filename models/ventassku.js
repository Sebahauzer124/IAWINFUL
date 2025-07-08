const mongoose = require('mongoose');

const ventasSkuSchema = new mongoose.Schema({}, { strict: false });

module.exports = mongoose.model('VentaSku', ventasSkuSchema, 'ventassku');

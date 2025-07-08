const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({}, { strict: false });

module.exports = mongoose.model('Stock', stockSchema, 'stocks');

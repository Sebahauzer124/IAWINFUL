const mongoose = require('mongoose');

const censoSchema = new mongoose.Schema({}, { strict: false });

module.exports = mongoose.model('Censo', censoSchema, 'censo');

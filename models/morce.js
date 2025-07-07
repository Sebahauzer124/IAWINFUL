const mongoose = require('mongoose');

const morceSchema = new mongoose.Schema({}, { strict: false });
module.exports = mongoose.model('Morce', morceSchema, 'morce');

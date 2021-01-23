const mongoose = require('mongoose');

const StatSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    timestamp: {
        type: String,
        required: false,
    },
    count: {
        type: Number,
        required: true,
    },
});

module.exports = mongoose.model("Stat",StatSchema);
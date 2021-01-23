const mongoose = require("mongoose");

const LocationSchema = mongoose.Schema({
    si : {
        type: String,
        required: false,
    },
    gun : {
        type: String,
        required: false,
    },
    up: {
        type: String,
        required: false,
    }
})

module.exports = mongoose.model("Location", LocationSchema);
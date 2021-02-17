const mongoose = require("mongoose");

const NoticeSchema = mongoose.Schema({
	content: {
		type: String,
		required: true,
	},
});

module.exports = mongoose.model("Notice", NoticeSchema);

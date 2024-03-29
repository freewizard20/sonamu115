const mongoose = require("mongoose");

const UserSchema = mongoose.Schema({
	name: {
		type: String,
		required: true,
	},
	password: {
		type: String,
		required: true,
	},
	explanation: {
		type: String,
		required: true,
	},
	phone: {
		type: String,
		required: true,
	},
	permission: {
		type: Number,
		required: true,
	}
});

module.exports = mongoose.model("User", UserSchema);

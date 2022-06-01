const mongoose = require("mongoose");

const ItemSchema = mongoose.Schema({
	views:{
		type:Number,
		required: true,
	},
	thumbnail: {
		type: String,
		required: false,
	},
	timestamp: {
		type: Number,
		required: true,
	},
	timestamp_modified: {
		type: Number,
		required: true,
	},
	type: {
		type: String,
		required: false,
	},
	sell: {
		type: String,
		required: false,
	},
	share: {
		type: String,
		required: false,
	},
	adon: {
		type: String,
		required: false,
	},
	contract: {
		type: String,
		required: false,
	},
	icon: {
		type: String,
		required: false,
	},
	ad: {
		type: Array,
		required: false,
	},
	theme: {
		type: Array,
		required: false,
	},
	user: {
		type: String,
		required: false,
	},
	id: {
		type: String,
		required: false,
	},
	id_letter: {
		type: String,
		required:false,
	},
	id_number: {
		type:String,
		required: false,
	},
	title: {
		type: String,
		required: false,
	},
	address_si: {
		type: String,
		required: false,
	},
	address_gun: {
		type: String,
		required: false,
	},
	address_up: {
		type: String,
		required: false,
	},
	address_li: {
		type: String,
		required: false,
	},
	address_bunji1: {
		type: String,
		required: false,
	},
	address_bunji2: {
		type: String,
		required: false,
	},
	area_ground: {
		type: Number,
		required: false,
	},
	area_ground2: {
		type: Number,
		required: false,
	},
	area_building: {
		type: Number,
		required: false,
	},
	area_building2: {
		type: Number,
		required: false,
	},
	area_rooms: {
		type: Number,
		required: false,
	},
	area_toilets: {
		type: Number,
		required: false,
	},
	area_recommended: {
		type: String,
		required: false,
	},
	area_use: {
		type: String,
		required: false,
	},
	area_using: {
		type: String,
		required: false,
	},
	area_orientation: {
		type: String,
		required: false,
	},
	area_yong: {
		type: Number,
		required: false,
	},
	area_gun: {
		type: Number,
		required: false,
	},
	area_road: {
		type: String,
		required: false,
	},
	area_mainroad: {
		type: String,
		required: false,
	},
	price_sell: {
		type: Number,
		required: false,
	},
	price_borrow: {
		type: Number,
		required: false,
	},
	price_jeon: {
		type: Number,
		required: false,
	},
	price_jeondeposit: {
		type: Number,
		required: false,
	},
	price_rentdeposit: {
		type: Number,
		required: false,
	},
	price_deposit: {
		type: Number,
		required: false,
	},
	price_rent: {
		type: Number,
		required: false,
	},
	price_unit: {
		type: Number,
		required: false,
	},
	price_monthly: {
		type: Number,
		required: false,
	},
	price_yearly: {
		type: Number,
		required: false,
	},
	price_margin: {
		type: Number,
		required: false,
	},
	price_published: {
		type: Number,
		required: false,
	},
	detail_temperature: {
		type: String,
		required: false,
	},
	detail_orientation: {
		type: String,
		required: false,
	},
	detail_structure: {
		type: String,
		required: false,
	},
	detail_date: {
		type: String,
		required: false,
	},
	detail_interior: {
		type: String,
		required: false,
	},
	detail_elevator: {
		type: String,
		required: false,
	},
	detail_use: {
		type: String,
		required: false,
	},
	detail_approval: {
		type: String,
		required: false,
	},
	detail_parking: {
		type: String,
		required: false,
	},
	detail_parking2: {
		type: String,
		required: false,
	},
	detail_phone: {
		type: String,
		required: false,
	},
	detail: {
		type: String,
		required: false,
	},
	gallery: {
		type: String,
		required: false,
	},
	memo: {
		type: String,
		required: false,
	},
	image: {
		type: Array,
		required: false,
	},
	image2: {
		type: Array,
		required: false,
	},
	move_available_date:{
		type: String,
		required: false,
	},
	tomok:{
		type: String,
		required: false,
	},
	electric:{
		type: String,
		required: false,
	},
	water:{
		type: String,
		required: false,
	},
	sewage:{
		type: String,
		required: false,
	},
	wusu:{
		type: String,
		required: false,
	},
	ground_angle: {
		type: String,
		required: false,
	}
});

module.exports = mongoose.model("Item", ItemSchema);

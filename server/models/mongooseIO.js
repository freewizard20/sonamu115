const mongoose = require('mongoose');
const bcrypt = require("bcryptjs");
const fs = require('fs');

const User = require("./User");
const Item = require("./Item");

async function getItemNumber(findQuery){	
	return new Promise(function(resolve,reject){
		Item.countDocuments(findQuery, function(err, count){
			resolve(count);
		});
	});
}

async function getAll(){
	await Item.find().skip(10).limit(10).then((result)=>{
		console.log(result);
	});
}

function postUser(name, password, explanation, phone, permission) {
	bcrypt.genSalt(10, function (err, salt) {
		bcrypt.hash(password, salt, function (err, hash) {
			const user = new User({
				name: name,
				password: hash,
				explanation: explanation,
				phone: phone,
				permission: permission,
			});
			user
				.save()
				.then(() => console.log("data saved.."))
				.catch(() => console.log("error"));
		});
	});
}

function deleteItem(givenId){
	Item.find({_id:givenId}).then((data)=>{
		if(typeof data[0].image != 'undefined'){
			for(let i = 0 ; i < data[0].image.length ; i++){
				fs.unlink('./public/images'+data[0].image[i],(err)=>{console.log(err)});
			}
		}
		Item.deleteOne({_id:givenId}).then(()=>{console.log('delete ' + givenId)});
	})	
}

function postItem(body, imageref) {
	if (body.icon === undefined) body.icon = "";
	if (body.ad === undefined) body.ad = "";
	if (body.theme === undefined) body.theme = "";
	if (body.price_jeon === undefined) body.price_jeon = "";
	if (body.price_unit === undefined) body.price_unit = "";
	if (body.views === undefined) body.views = 0;
	
	body.timestamp_modified = new Date().getTime();
	body.timestamp = new Date().getTime();

	body.image = imageref;

	//console.log(body);

	//console.log(body);
	const item = new Item(
		body
	);
	item
		.save()
		.then(() => console.log("item saved.."))
		.catch((err) => console.log(err));
}

// function postItem(name, size)

module.exports = {
	getItemNumber: getItemNumber,
	getAll: getAll,
	postUser: postUser,
	postItem: postItem,
	User: User,
	Item: Item,
	deleteItem,
}

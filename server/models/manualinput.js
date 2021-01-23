const mongoose = require('mongoose');
const mongooseIO = require('./mongooseIO.js');
const randomWord = require('random-word');
const Item = require('./Item');
const Location = require('./Location');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const fs = require('fs');
const { brotliDecompress } = require('zlib');

mongoose.connect(
	"mongodb://localhost/sonamu",
	{useNewUrlParser: true, useUnifiedTopology: true},
	()=>{
		console.log("connected to DB");
	}
);

function serialToTimestamp(serial) {
	var utc_days  = Math.floor(serial - 25569);
	var utc_value = utc_days * 86400;                                        
	var date_info = new Date(utc_value * 1000);
 
	var fractional_day = serial - Math.floor(serial) + 0.0000001;
 
	var total_seconds = Math.floor(86400 * fractional_day);
 
	var seconds = total_seconds % 60;
 
	total_seconds -= seconds;
 
	var hours = Math.floor(total_seconds / (60 * 60));
	var minutes = Math.floor(total_seconds / 60) % 60;
 
	return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds).getTime();
 }

 function typeConvert(given){
	 let test = '';
	 switch (given) {
		case '001':
			test = 'house';
			break;
		case '002':
			test = 'farm';
			break;
		case '003':
			test = 'land';
			break;
		case '004':
			test = 'motel';
			break;
		case '007':
			test = 'villa';
			break;
		case '008':
			test = 'building';
			break; 
	 }
	 return test;
 }

 function sellConvert(given){
	 let test = '';
	 switch(given){
		case '1':
			 test = 'sell';
			 break;
		case '2':
			test = 'jeon';
			break;
		case '3':
			test = 'rent';
			break;
	}
	return test;
}

function ynConvert(given){
	if(given=='0') return 'N';
	else return 'Y';
}

function contractConvert(given){
	if(given==='진행') return 'on';
	else if(given==='보류') return 'pending';
	else return 'complete';
}

function iconConvert(given){
	let test = 'not_used';
	switch(given){
		case '01':
			test = 'recommend';
			break;
		case '02':
			test = 'valley';
			break;
		case '03':
			test = 'garden';
			break;
		case '04':
			test = 'urgent';
			break;
		case '05':
			test = 'national';
			break;
		case '06':
			test = 'best';
			break;
		case '07':
			test = 'remodel';
			break;
		case '08':
			test = 'outbuilding';
			break;
		case '09':
			test = 'interior';
			break;
		case '10':
			test = 'luxury';
			break;
		case '11':
			test = 'done';
			break;
		case '12':
			test = 'almost';
			break;
		case '13':
			test = 'new';
			break;	
	}
	return test;
}

function adConvert(given){
	let test = [];
	let given2 = given.split(',');
	for(let i = 0 ; i < given2.length ; i++){
		given2[i] = given2[i].replace(/ /g,'');
		switch(given2[i]){
			case '9':
				test.push('gallery');
				break;
			case '5':
				test.push('recommended');
				break;
			case '1':
				test.push('urgent');
				break;
			case '8':
				test.push('premium');
				break;
			case '2':
				test.push('new');
				break;
			case '3':
				test.push('theme');
				break;
			case '4':
				test.push('land');
				break;
		}
	}
	return test;
}

function themeConvert(given){
	let test = [];
	let given2 = given.split(',');
	for(let i = 0 ; i < given2.length ; i++){
		given2[i] = given2[i].replace(/ /g,'');
		switch(given2[i]){
			case '12':
				test.push('landscape');
				break;
			case '01':
				test.push('scene');
				break;
			case '02':
				test.push('river');
				break;
			case '04':
				test.push('south');
				break;
			case '05':
				test.push('mountainside');
				break;
			case '06':
				test.push('private');
				break;
			case '07':
				test.push('school');
				break;
			case '08':
				test.push('valley');
				break;
			case '09':
				test.push('subway');
				break;
			case '10':
				test.push('flatland');
				break;
			case '11':
				test.push('complex');
				break;
		}
	}
	return test;
}

function uploadDatabase(){
	let workbook = XLSX.readFile('Book1.xlsx').Sheets["Sheet2"];
	console.log('Book1 open');
	let words = XLSX.utils.sheet_to_json(workbook);
	let items = [];
	for(let i = 0 ; i < words.length ; i++){
		let body = {};
		// add words information to body
		body.tmp_id = words[i].lnd_seq;
		body.views = words[i].lnd_read;
		body.timestamp = serialToTimestamp(words[i].lnd_datetime);
		body.timestamp_modified = serialToTimestamp(words[i].lnd_date);
		body.type = typeConvert(words[i].lnd_type);
		body.sell = sellConvert(words[i].lnd_subtype);

		if(body.sell==='jeon' || body.sell==='rent'){
			body.type = 'rent';
		}
		if(body.type==='farm'){
			body.type = 'house';
		}else if(body.type==='motel'){
			body.type = 'consumer';
		}else if(body.type==='building'){
			body.type = 'consumer';
		}

		body.share = ynConvert(words[i].lnd_join);
		body.adon = ynConvert(words[i].ad_onoff);
		body.contract = contractConvert(words[i].lnd_access);
		body.icon = iconConvert(words[i].lnd_icon);
		body.ad = adConvert(words[i].lnd_submit);
		body.theme = themeConvert(words[i].ad_gubun2);
		body.user = words[i].mem_ID;
		body.id_letter = words[i].lnd_key;
		body.id_number = words[i].lnd_code;
		body.id = body.id_letter + body.id_number;
		body.title = words[i].lnd_addr2;
		body.address_si = words[i].lnd_addr1_do;
		body.address_gun = words[i].lnd_addr1_city;
		body.address_up = words[i].lnd_addr1_dong;
		body.address_li = words[i].lnd_addr1_lee;
		body.address_bunji1 = words[i].lnd_addr1_bun1;
		body.address_bunji2 = words[i].lnd_addr1_bun2;
		body.area_ground = words[i].lnd_landarea;
		body.area_ground2 = words[i].lnd_landarea_mm;
		body.area_building = words[i].lnd_area;
		body.area_building2 = words[i].lnd_area_mm;
		body.area_rooms = words[i].lnd_room;
		body.area_toilets = words[i].lnd_bathroom;
		body.area_recommended = words[i].lnd_txt_field3;
		body.area_use = words[i].lnd_txt_field2;
		body.area_using = words[i].lnd_txt_field1;
		body.area_orientation = words[i].lnd_txt_direction;
		body.area_yong = words[i].lnd_per_yong;
		body.area_gun = words[i].lnd_per_gun;
		body.area_road = words[i].lnd_txt_jointrans;
		body.area_mainroad = words[i].lnd_txt_trans_point;
		body.price_sell = words[i].lnd_meMoney;
		body.price_borrow = words[i].lnd_yungMoney;
		body.price_jeon = words[i].lnd_junMoney;
		body.price_jeondeposit = words[i].lnd_junMoney;
		body.price_rentdeposit = words[i].lnd_boMoney;
		body.price_deposit = words[i].lnd_boMoney;
		body.price_rent = words[i].lnd_mmMoney;
		body.price_unit = words[i].lnd_subMoney1;
		body.price_monthly = words[i].lnd_mmSunMoney;
		body.price_yearly = words[i].lnd_yySunMoney;
		body.price_margin = words[i].lnd_suyekper;
		body.price_published = typeof words[i].lnd_txt_field1==='number'?words[i].lnd_txt_field1:0;
		body.detail_temperature = words[i].lnd_txt_nanbang;
		body.detail_orientation = words[i].lnd_txt_direction;
		body.detail_structure = words[i].lnd_txt_field3;
		body.detail_date = words[i].lnd_txt_jungong;
		body.detail_interior = 'N';
		body.detail_elevator = words[i].lnd_txt_elevator;
		body.detail_use = words[i].lnd_txt_field2;
		body.detail_approval = words[i].lnd_txt_field3;
		body.detail_parking = words[i].lnd_txt_parkType;
		body.detail_parking2 = words[i].lnd_txt_parking;
		body.detail_phone = words[i].lnd_txt_TelCnt;
		body.detail = words[i].ad_note.replace(/&nbsp;/gi, '');
		body.gallery = words[i].lnd_txt_note2.replace(/&nbsp;/gi,'');
		body.memo =	words[i].lnd_note;
		body.image = [];
		body.thumbnail = "";			
		items.push(body);
	}

	console.log('words done...');
	console.log('items count : ' + items.length);

	words = 'a';
	let pictures = XLSX.utils.sheet_to_json(XLSX.readFile('photos.xlsx').Sheets["Sheet3"]);
	console.log('pictures open');
	for(let i = 0 ; i < pictures.length ; i++){
		if(i % 1000 === 0) console.log(i);
		// find the body inside items.
		let current = 0;
		for(let j = 0 ; j < items.length ; j++){
			if(pictures[i].lnd_photo_seq === items[j].tmp_id){
				items[j].image.push('/old' + pictures[i].lnd_photo);
				break;
			}
		}
	}

	console.log('pictures done...');

	// add to database
	for(let i = 0 ; i < items.length ; i++){
		delete items[i].tmp_id;
		const item = new Item(items[i]);
		item.save().then(()=>{
			if(i%1000===0)console.log(i); 
			if(i===items.length-1) console.log('done...');
		}).catch((err)=>{console.log(err)});
	}
}

function randomNumber(given){
	return Math.floor(Math.random()*given);
}

function makeItem(){
	let body = {};
	let typeSelect = ['house', 'land', 'consumer','rent','factory','villa'];
	let typeSell = ['sell','jeon','rent'];
	let yesNo = ['Y','N'];
	let typeContract = ['on','pending','complete']
	let typeIcon = ['recommend','valley','garden','urgent','national','best','remodel','outbuilding','interior','luxury','done','almost','new','not_used'];
	let typeAd = ['gallery','recommended','urgent','premium','new','theme','land'];
	let typeTheme = ['landscape','scene','river','south','mountainside','private','school','valley'];
	let typeUser = ['admin','fw'];
	let typeUp = ['가면','나면','다면','라면'];
	let typeLi = ['가리','나리','다리','마리'];

	body.views = randomNumber(10000);
	body.timestamp_modified = new Date().getTime();
	body.timestamp = new Date().getTime();
	body.type = typeSelect[Math.floor(Math.random()*6)];
	body.sell = typeSell[Math.floor(Math.random()*3)];
	body.share = yesNo[Math.floor(Math.random()*2)];
	body.adon = yesNo[Math.floor(Math.random()*2)];
	body.contract = typeContract[Math.floor(Math.random()*3)];
	body.icon = typeIcon[Math.floor(Math.random()*14)];
	body.ad = typeAd[Math.floor(Math.random()*7)];
	body.theme = typeTheme[Math.floor(Math.random()*8)];
	body.user = typeUser[Math.floor(Math.random()*2)];
	body.id = randomWord()+randomNumber(1000);
	body.title = randomWord() + " " + randomWord();
	body.address_si = '경기도';
	body.address_gun = '양평군';
	body.address_up = typeUp[Math.floor(Math.random()*4)];
	body.address_li = typeLi[Math.floor(Math.random()*4)];
	body.address_bunji1 = Math.floor(Math.random()*200);
	body.address_bunji2 = Math.floor(Math.random()*200);
	body.area_ground = Math.floor(Math.random()*1000);
	body.area_building = Math.floor(Math.random()*1000);
	body.area_rooms = randomNumber(5);
	body.area_toilets = randomNumber(5);
	body.area_recommended = randomWord();
	body.area_use = randomWord();
	body.area_using = randomWord();
	body.area_orientation = randomWord();
	body.area_yong = randomNumber(100);
	body.area_gun = randomNumber(100);
	body.area_road = randomWord();
	body.area_mainroad = randomWord();
	body.price_sell = randomNumber(1000000);
	body.price_borrow = randomNumber(1000000);
	body.price_jeon = randomNumber(1000000);
	body.price_jeondeposit = randomNumber(1000000);
	body.price_rentdeposit = randomNumber(1000000);
	body.price_deposit = randomNumber(1000000);
	body.price_rent = randomNumber(1000000);
	body.price_unit = randomNumber(1000000);
	body.price_monthly = randomNumber(1000000);
	body.price_yearly = randomNumber(1000000);
	body.price_margin = randomNumber(1000000);
	body.price_published = randomNumber(1000000);
	body.price_detail = randomNumber(1000000);
	body.price_gallery = randomNumber(1000000);
	body.price_memo = randomNumber(1000000);
	body.detail_temperature = randomWord();
	body.detail_orientation = randomWord();
	body.detail_structure = randomWord();
	body.detail_date = randomWord();
	body.detail_interior = randomWord();
	body.detail_elevator = randomWord();
	body.detail_use = randomWord();
	body.detail_approval = randomWord();
	body.detail_parking = randomWord();
	body.detail_parking2 = randomWord();
	body.detail_phone = randomWord();
	body.detail = randomWord() + ' ' + randomWord() + ' ' + randomWord();
	body.gallery =  randomWord() + ' ' + randomWord() + ' ' + randomWord();
	body.memo =  randomWord() + ' ' + randomWord() + ' ' + randomWord();

	imageref = ['/example.jpg','/example.jpg','/example.jpg','/example.jpg','/example.jpg'];
	body.thumbnail = '/example.jpg';

	mongooseIO.postItem(body,imageref);
}

function addUsers(){
	mongooseIO.postUser("fw","s90909");
	mongooseIO.postUser("admin","3756++");
	mongooseIO.postUser("agassi37","henssum37");
}

function addDummyDatabase(){
	console.log(i);
	makeItem();
}

function countThumbnails(){
	let needThumbnails = 0;
	Item.find().then((data)=>{
		console.log('Total items in DB : ' + data.length);
		for(let i = 0 ; i < data.length ; i++){
			if(Array.isArray(data[i].image) && data[i].image.length!==0){
				needThumbnails++;
			}
		}

		console.log('DB items with images count : ' + needThumbnails);

		const dir = '../public/images/thumbnail';
		if(fs.existsSync(dir)){
			fs.readdir(dir,(err,files)=>{
				console.log('Number of thumbnails : ' + files.length);
				console.log(files[0]);
			})
		}
	})
}

function makeThumbnails(){
	if(!fs.existsSync('../public/images/thumbnail')){
		fs.mkdirSync('../public/images/thumbnail');
	}
	Item.find().then((data)=>{
		console.log('data found..');

		let block = true;
		let last = 0;
		for(let i = data.length-1 ; i>=0; i--){
			if(data[i].image.length!=0){
				last = i;
				break;
			}
		}

		for(let i = 0 ; i < data.length ; i++){			
			if(data[i].image.length!=0){
				let uuid = uuidv4();
				sharp('../public/images' + data[i].image[0]).resize({fit:'fill',width:233,height:165})
				//.toFile('out.jpg');
				.toFile('../public/images/thumbnail/' + uuid + '.jpg',(err,info)=>{
					if(i%1000===0) console.log('file creation ' + i);
					if(i===last){
						console.log('start db update');
						let loopArray = function(x){
							if(x===data.length){
								return;
							}else{
								Item.updateOne({_id:data[x]._id}, data[x]).then(()=>{
									if(x%1000===0) console.log(x);
									if(x===data.length-1) console.log('process done..');
									loopArray(x+1);
								}).catch((err)=>{
									console.log(err);
									loopArray(x+1);
								});
							}
						}
						loopArray(0);
					}				
				});
				data[i].thumbnail = "/thumbnail/" + uuid + '.jpg';
			}else{
				
			}
		}	
	}).catch((err)=>{console.log(err)});
}

function getFilesizeInBytes(filename) {
	if(!fs.existsSync(filename)){
		console.log('does not exist : ' + filename);
		return -1;
	}else{
		var stats = fs.statSync(filename);
		var fileSizeInBytes = stats.size;
		return fileSizeInBytes;
	}
}

// console.log(getFilesizeInBytes('../public/images/old/2019/10/20490_(4).jpg'));

function customAlert(data, callback) {

	if(typeof data.image !== 'undefined' && data.image.length!=0){
		let lastOne = -1;
		for(let z = data.image.length-1 ; z >= 0 ; z--){
			if(getFilesizeInBytes('../public/images'+data.image[z])>1000000){
				console.log('found ' + data.image[z]);
				lastOne = z;
				break;
			}
		}

		if(lastOne===-1) {
			setTimeout(()=>{
				callback();
				return;
			},10);			
		}

		for(let j = 0 ; j < data.image.length ; j++){
			if(getFilesizeInBytes('../public/images'+data.image[j])>1000000 && data.image[j].substr(data.image[j].length-3)!=='gif'){
				fs.rename('../public/images'+data.image[j],	'../public/images'+data.image[j]+'.jpg',(err)=>{
					if(err){
						console.log('rename Error ' + err);
					}else{
					// make backup and restore if sharp error
					sharp('../public/images'+data.image[j]+'.jpg').resize({fit:'fill',width:950,height:550}).toFile('../public/images/'+data.image[j],(err2)=>{
						if(err2){
							console.log('sharp Error ' + err2);
						}else{
							fs.unlink('../public/images'+data.image[j]+'.jpg',(err3)=>{
								if(j===lastOne) callback();
							});
						}
					})
				}
				})
			}
		}
	}else{
		callback();
	}	
}

function trimImages(){
	Item.find().then((data)=>{
		console.log(data.length + ' items found');
		let x = 0;
		let loopArray = function(arr) {
			customAlert(arr[x],function(){
				if(x%100===0) console.log(x + 'th item');
				x++;
				if(x<arr.length){
					loopArray(arr);
				}
			})
		}
		loopArray(data);
	})
}

function trimImagesSync(){
	Item.find().then((data)=>{
		console.log(data.length + ' items found');
		let loopArray = function(x, y){
			if(x%30===0 && y===0) console.log(x + ' th item');
			if(x===data.length){
				return;
			}else{
				if(typeof data[x].image === 'undefined'){
					loopArray(x+1,0);
				}else{
					if(y===data[x].image.length){
						loopArray(x+1,0);
					}else{
						// do work
						if(data[x].image[y].substr(data[x].image[y].length-3)!=='gif' && fs.existsSync('../public/images'+data[x].image[y]) && getFilesizeInBytes('../public/images'+data[x].image[y])!=0){
						fs.copyFile('../public/images'+data[x].image[y], '../public/images/temp',(e)=>{
							if(e) console.log(x + ' ' + y + ' ' + e);
							else{
								fs.rename('../public/images' + data[x].image[y], '../public/images' + data[x].image[y] + '.jpg',(err)=>{
									if(err){
										console.log(x + ' rename Error ' + err);
									}else{
										sharp('../public/images' + data[x].image[y]+'.jpg').resize({fit:'fill',width:950,height:550}).toFile('../public/images/'+data[x].image[y],(err2)=>{
											if(err2){
												console.log(x + ' ' + y + ' sharp Error ' + err2);
												console.log(data[x].image[y]);
												fs.unlink('../public/images'+data[x].image[y]+'.jpg',(a)=>{
													console.log('backup file : ' + getFilesizeInBytes('../public/images/temp'))
													fs.rename('../public/images/temp','../public/images'+data[x].image[y],(b)=>{
														if(fs.existsSync('../public/images/temp')) console.log('temp file still there');
														loopArray(x,y+1);
													})
												})			
												
											}else{
												fs.unlink('../public/images'+data[x].image[y]+'.jpg',(err3)=>{
													fs.unlink('../public/images/temp',(c)=>{
														loopArray(x,y+1);
													})													
												})
											}
										})
									}
								})
							}
						})						
						}else{
							if(getFilesizeInBytes('../public/images'+data[x].image[y])===0) console.log('originally broken : ' + data[x].image[y]);
							loopArray(x, y+1);
						}
					}
				}				
			}
		}
		loopArray(0,0);
	})
}

function countTest(){
	let count = 0;
	Item.find().then((data)=>{
		for(let i = 0 ; i < data.length ; i++){
			if(typeof data[i].image==='undefined') {
				console.log(data._id);
				continue;
			}
			if(data[i].image.length!=0) count++;
		}
		console.log('images count : ' + count);
	})
}

function test(){
	/*
	Item.find({id:'W934'}).then((data)=>{
		data[0].title = 'hello world';
		Item.updateOne({_id:data[0]._id},data[0]).then(()=>{console.log('done')});
	});*/
	fs.rename('./18980_(0).jpg','./18980_(0).jpg.jpg',(err)=>{
		sharp('./18980_(0).jpg.jpg').resize({fit:'fill',width:950,height:550}).toFile('./18980_(0).jpg',function(err){
			fs.unlink('./18980_(0).jpg.jpg',(err3)=>{});
		})
	})
}

function recursive(index){
	console.log(index);
	if(index===0){
		fs.rename('./3.PNG',(index+1)+'.png',(err)=>{
			recursive(index+1);
		})		
	}else if(index===100){
		return;
	}else{
		fs.rename(index+'.png',(index+1)+'.png',(err)=>{
			recursive(index+1);
		})
	}
}

// recursive(0);

function countMissingImages(){
	console.log('countMissingImages..');
	Item.find().then((data)=>{
		console.log(data.length + ' data found');
		let count = 0;
		let count2 = 0;
		for(let i = 0 ; i < data.length ; i++){
			if(i%100===0) console.log(i + ' items searched');
			if(typeof data[i].image !== 'undefined' && data[i].image.length!=0){
				for(let j = 0 ; j < data[i].image.length ; j++){
					if(!fs.existsSync('../public/images'+data[i].image[j])){
						console.log('missing ' + data[i].image[j]);
						count++;
					}
					if(getFilesizeInBytes('../public/images'+data[i].image[j])===0){
						console.log('broken ' + data[i].image[j]);
						count2++;
					}
				}
			}
		}
		console.log('missing count : ' + count);
		console.log('broken count : ' + count2);
	})
}

function addLocationSync(){
	let workbook = XLSX.readFile('locations.xlsx').Sheets["Sheet2"];
	console.log('Locations book open');
	let locations = XLSX.utils.sheet_to_json(workbook);
	let loopArray = function(x){
		if(x%100===0) console.log(x + 'th item');
		if(x===locations.length){
			console.log('done...');
			return;
		}else{
			Location.find({si:locations[x].si,gun:locations[x].do,up:locations[x].dong}).then((data)=>{
				if(data.length===0){
					const location = new Location({
						si: locations[x].si,
						gun: locations[x].do,
						up: locations[x].dong,
					})

					location.save().then(()=>{
						loopArray(x+1);
					})
				}else{
					loopArray(x+1);
				}
			})
		}
	}
	loopArray(0);
}

// addUsers(addUsers) >> addLocation(addLocationSync) >> uploadDatabase(uploadDatabase) >> 이미지 업로드(ftp) >> 
// images/thumbnail directory >> makeThumbnails(makeThumbnails) >> trimimages(trimImages)
// addDummyDatabase();
// addUsers();
// addLocationSync();
// uploadDatabase();
// makeThumbnails();
// countThumbnails();
// trimImagesSync();
// countMissingImages();


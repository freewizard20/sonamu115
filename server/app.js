const mongoose = require("mongoose");
const mongooseIO = require("./models/mongooseIO.js");
const util = require("./utils/util");
const cron = require('node-cron');
const useragent = require('express-useragent');
const fs = require('fs');
const XLSX = require('xlsx');
const xss = require('xss');
const sharp = require('sharp');
const logger  = require('./config/winston');
const helmet = require('helmet');
const he = require('he');
const iconv = require('iconv-lite');
const querystring = require('querystring');
const path = require('path');
const cors = require('cors');

const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const secretObj = require("./utils/jwt");
const jwt = require("jsonwebtoken");
const { find, countDocuments } = require("./models/User.js");
const Stat = require('./models/Stat.js');
const { getItemNumber } = require("./models/mongooseIO.js");
const Location = require('./models/Location.js');

const User = mongooseIO.User;
const Item = mongooseIO.Item;
const Notice = mongooseIO.Notice;
const app = express();
const upload = multer({ dest: 'public/images/' });

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(bodyParser.json());
app.use(express.urlencoded());
app.use(cookieParser());
// app.use(helmet());

app.use(
	helmet.referrerPolicy({
		policy: "no-referrer",
	})
);

app.use(
	helmet.permittedCrossDomainPolicies({
		permittedPolicies: "none",
	})
);

app.disable('x-powered-by');


let searchHistory = {};
let searchHistoryClient = {};
let userInfo = {};

if(!fs.existsSync('./public/images/thumbnail')){
	fs.mkdirSync('./public/images/thumbnail');
}
if(!fs.existsSync('./public/images/thumbnail/old')){
	fs.mkdirSync('./public/images/thumbnail/old');
}

app.all('*', flushSearchHistory);

cron.schedule('0 0 4 * * *',()=>{
	searchHistoryClient = {};
	userInfo = {};
	searchHistory = {};
	Stat.find({name:'total'}).then((data)=>{
		const stat = new Stat({name: 'today', timestamp: new Date().getTime(), count: data[0].count});
		stat.save().then(()=>{});
		Stat.updateOne({name:'total'},{name:'total',count: 0}).then(()=>{logger.info('updated visitor stats')});
	})
})


function flushSearchHistory(req, res, next) {
	// mobile redirect
	if(req.path === '/' && !(req.path === '/m' || req.path ==='/images' || req.path ==='/mitem')){
		let source = req.headers['user-agent'];
		let ua = useragent.parse(source);
		console.log(req.query.option);
		if(ua.isMobile && (typeof req.query.option === 'undefined')){
			res.redirect('/m');
			next();
		}
		else return next();
	}

	// add visitors
	if(req.cookies.visited || req.cookies.visited==='admin' || req.path === '/login' || req.path === '/manage' || req.path === '/stats' || req.path === '/register' || req.path === 'details' || req.path==='/images'){
		if(req.cookies.visited){

		}else{
			res.cookie('visited','admin');
		}
	}else{
		Stat.find({name:'total'}).then((data)=>{
			if(data.length===0){
				const stat = new Stat({name: 'total', count: 1});
				stat.save()
				.then(()=>{})
				.catch((err)=> console.log(err));
			}else{
				Stat.updateOne({name:'total'},{name:'total',count: data[0].count + 1}).then(()=>{});
			}
		})

		if(req.path==='/m'||req.path==='/mitem'){
			Stat.find({name:'mobile'}).then((data)=>{
				if(data.length===0){
					const stat = new Stat({name: 'mobile', count: 1});
					stat.save()
					.then(()=>{})
					.catch((err)=> console.log(err));
				}else{
					Stat.updateOne({name:'mobile'},{name:'mobile',count: data[0].count + 1}).then(()=>{});
				}
			})
		} else {
			Stat.find({name:'desktop'}).then((data)=>{
				if(data.length===0){
					const stat = new Stat({name: 'desktop', count: 1});
					stat.save()
					.then(()=>{})
					.catch((err)=> console.log(err));
				}else{
					Stat.updateOne({name:'desktop'},{name:'desktop',count: data[0].count + 1}).then(()=>{});
				}
			})
		}
		res.cookie('visited','true');
	}

	return next();
}

function jwtverify(cookie) {
	try {
		return jwt.verify(cookie.user, secretObj.secret);
	} catch {
		return false;
	}
}

app.get('/si',(req,res)=>{
	// console.log('/si GET');
	// console.log(req.query);
	// console.log(req.header('User-Agent'));
	// console.log(req.query.name);
	let query;
	if(req.header('User-Agent').match(/(MSIE|Trident)/)){
		query = querystring.unescape(req.query.name)
	}else{
		query = req.query.name;
	}
	// console.log(query);
	// console.log(iconv.decode(req.query.name,'euc-kr'));
	Location.find({si: query}).then((data)=>{
		let returnArray = [];
		for(let i = 0 ; i < data.length ; i++){
			if(!returnArray.includes(data[i].gun)){
				returnArray.push(data[i].gun);
			}
		}
		res.send(returnArray);
	})
})

app.get('/gun',(req,res)=>{
	let query;
	if(req.header('User-Agent').match(/(MSIE|Trident)/)){
		query = querystring.unescape(req.query.name)
	}else{
		query = req.query.name;
	}
	Location.find({gun:query}).then((data)=>{
		let returnArray = [];
		for(let i = 0 ; i < data.length ; i++){
			if(!returnArray.includes(data[i].up)){
				returnArray.push(data[i].up);
			}
		}
		res.send(returnArray);
	})
})

app.get('/m',(req,res)=>{
	let skipQuery = 0;
	if(req.query.skip){
		skipQuery = 20 + req.query.skip * 4;
	}
	let findQuery = {adon:'Y'};
	let listType = '추천매물';
	let fillSearchBox = JSON.stringify({});
	if(req.query.category){
		if(req.query.category === 'recommended'){
			findQuery.ad = 'recommended';
			listType = '추천매물';
		}else if(req.query.category==='urgent'){
			findQuery.ad = 'urgent';
			listType = '급매물';
		}else if(req.query.category==='house'){
			findQuery.type = 'house'
			listType = '전원주택/별장/펜션';
		}else if(req.query.category==='land'){
			findQuery.type = 'land';
			listType = '토지/농막';
		}else if(req.query.category==='commercial'){
			findQuery.type = 'consumer';
			listType = '상가/모텔/빌딩';
		}else if(req.query.category==='affordable'){
			findQuery.price_sell = {};
			findQuery.price_sell.$lte = 30000;
			findQuery.sell = 'sell';
			findQuery.type = {};
			findQuery.type.$in = ['house','villa'];
			listType = '3억 이하 매물';
		}else if(req.query.category==='midprice'){
			findQuery.price_sell = {};
			findQuery.price_sell.$lte = 60000;
			findQuery.price_sell.$gte = 30000;
			findQuery.type = {};
			findQuery.type.$in = ['house','villa'];
			findQuery.sell = 'sell';
			listType = '3억 ~ 6억 매물';
		}else if(req.query.category==='highprice'){
			findQuery.price_sell = {};
			findQuery.price_sell.$lte = 100000;
			findQuery.price_sell.$gte = 60000;
			findQuery.sell = 'sell';
			findQuery.type = {};
			findQuery.type.$in = ['house','villa'];
			listType = '6억 ~ 10억 매물';
		}else if(req.query.category==='luxury'){
			findQuery.price_sell = {};
			findQuery.price_sell.$gte = 100000;
			findQuery.sell = 'sell';
			findQuery.type = {};
			findQuery.type.$in = ['house','villa'];
			listType = '10억 이상 매물'
		}
		else if(req.query.category==='affordable_land'){
			findQuery.price_sell = {};
			findQuery.price_sell.$lte = 20000;
			findQuery.sell = 'sell';
			findQuery.type = 'land'
			listType = '2억 이하 토지';
		}else if(req.query.category === 'midprice_land'){
			findQuery.price_sell = {};
			findQuery.price_sell.$gte = 20000;
			findQuery.price_sell.$lte = 50000;
			findQuery.sell = 'sell';
			findQuery.type = 'land'
			listType = '2억 ~ 5억 토지';
		}else if(req.query.category === 'highprice_land'){
			findQuery.price_sell = {};
			findQuery.price_sell.$gte = 50000;
			findQuery.sell = 'sell';
			findQuery.type = 'land'
			listType = '5억 이상 토지';
		}else{
			listType = "검색결과";
			fillSearchBox = JSON.stringify(searchHistoryClient[req.query.category]);
			// uuid query
			if(req.query.category && searchHistoryClient[req.query.category]){
				let sh = searchHistoryClient[req.query.category];
				if(sh.type){
					findQuery.type = {};
					findQuery.type.$in = sh.type;
				}
				if (sh.price_low || sh.price_high) {
					findQuery.price_sell = {};
					if (sh.price_high) findQuery.price_sell.$lte = Number(sh.price_high);
					if (sh.price_low) findQuery.price_sell.$gte = Number(sh.price_low);
				}
				if (sh.area_ground_high || sh.area_ground_low) {
					findQuery.area_ground = {};
					if (sh.area_ground_high) findQuery.area_ground.$lte = Number(sh.area_ground_high);
					if (sh.area_ground_low) findQuery.area_ground.$gte = Number(sh.area_ground_low);
				}
				if (sh.area_building_high || sh.area_building_low) {
					findQuery.area_building = {};
					if (sh.area_building_high) findQuery.area_building.$lte = Number(sh.area_building_high);
					if (sh.area_building_low) findQuery.area_building.$gte = Number(sh.area_building_low);
				}
				if(sh.theme){
					findQuery.theme = {};
					findQuery.theme.$all = sh.theme;
				}
				if(sh.recommended){
					if(sh.recommended.includes('전체선택')){

					}else {
						findQuery.detail_structure = {};
						if(sh.recommended.includes('기타')){
							if(Array.isArray(sh.recommended)){
								const idx = sh.recommended.indexOf('기타');
								sh.recommended.splice(idx,1);
							}else{
								sh.recommended = [];
							}
							let regexBuilder = '';
							for(let i = 0 ; i  < sh.recommended.length ; i++){
								if(sh.recommended[i]==='조적조'){
									regexBuilder = regexBuilder.concat('조적조|연와조|시멘트벽돌조|벽돌구조|')
								}else{
									regexBuilder = regexBuilder.concat(sh.recommended[i]+'|');
								}
							}
							regexBuilder = regexBuilder.concat('[^철근콘크리트|일반목구조|조적조|경량철골조]');
							//console.log(regexBuilder);
							findQuery.detail_structure = new RegExp(regexBuilder);
							findQuery.type="house";
						}else{
							if(typeof sh.recommended === 'string'){
								findQuery.detail_structure.$in = [];
								findQuery.detail_structure.$in.push(sh.recommended);
							}else{
								findQuery.detail_structure.$in = sh.recommended;
							}
							if(sh.recommended.includes('조적조')){
								findQuery.detail_structure.$in.push('연와조');
								findQuery.detail_structure.$in.push('시멘트벽돌조');
								findQuery.detail_structure.$in.push('벽돌구조');
							}
							if(sh.recommended.includes('일반목구조')){
								findQuery.detail_structure.$in.push('목조');
								findQuery.detail_structure.$in.push('목구조');
							}
						}
					}
				}
				if(sh.location){
					if(sh.location.includes('기타지역')){
						if(Array.isArray(sh.location)){
							const idx = sh.location.indexOf('기타지역');
							sh.location.splice(idx,1);
							let regexBuilder = '';
							for(let i = 0 ; i < sh.location.length ; i++){
								regexBuilder = regexBuilder.concat(sh.location[i]+'|');
							}
							regexBuilder = regexBuilder.concat('[^강하면|강상면|양평읍|옥천면|양서면|서종면|용문면|지평면|개군면]');
							findQuery.address_up = new RegExp(regexBuilder);
						}else{
							findQuery.address_up = {};
							findQuery.address_up.$nin = ['강하면','강상면','양평읍','옥천면','양서면','서종면','용문면','지평면','개군면'];
						}
					}else{
						findQuery.address_up = {};
						findQuery.address_up.$in = sh.location;
					}
				}
				if(sh.id){
					findQuery.id = new RegExp(sh.id,'i');
				}
				if(sh.title){
					findQuery.title = new RegExp(sh.title,'i');
				}
			}
		}
	}
	let limitQuery = skipQuery===0? 24 : 4;
	Item.find(findQuery).sort('-timestamp_modified').skip(skipQuery).limit(limitQuery).then((data)=>{
		if(skipQuery===0) res.render('mobile',{data:data, listType: listType, fillSearchBox:fillSearchBox});
		else res.render('mskip',{data:data});
	});	
});

app.post('/m',(req,res)=>{
	let uuid = uuidv4();
	req.body.id = xss(req.body.id);
	req.body.title = xss(req.body.title);

	searchHistoryClient[uuid] = req.body;
	res.redirect('/m?category=' + uuid);
});

app.get('/mitem',(req,res)=>{
	let query = req.query.id;
	Item.find({_id:query}).then((data)=>{
		if(data.length===0){
			logger.info('access to invalid item /mitem ' + req.query.id);
			res.render('404');
		}else{
			data[0].detail = he.decode(data[0].detail).replace(/nbsp;/gi,'');
			data[0].views = data[0].views ? data[0].views + 1 : 0;
			Item.updateOne({_id: query}, data[0]).then(()=>{});
			User.find({name:data[0].user}).then((user)=>{
				res.render('mitem',{data:data[0],user:user[0]});
			})
		}	
	})	
})

app.get("/", (req, res) => {
	Item.find({adon: 'Y', ad:'gallery'}).sort('-timestamp_modified').then((gallery)=>{
		for(let i = 0 ; i < gallery.length ; i++){
			gallery[i].gallery = he.decode(gallery[i].gallery).replace(/&nbsp;/gi,'');
		}
		Item.find({adon: 'Y', ad:'recommended'}).sort('-timestamp_modified').limit(10).then((recommended)=>{
			Item.find({adon: 'Y', sell:'sell',type:'house',price_sell:{$gte : 100000}}).sort('-timestamp_modified').limit(10).then((luxury)=>{
				Item.find({adon: 'Y', type:'land'}).sort('-timestamp_modified').limit(10).then((land)=>{
					Item.find({adon: 'Y', sell:'sell',price_sell:{$lte:30000}}).sort('-timestamp_modified').limit(10).then((affordable)=>{
						Item.find({adon: 'Y', type: {$in: ['consumer']}}).sort('-timestamp_modified').limit(5).then((commercial)=>{
							Item.find({adon: 'Y', sell:{$in:['rent','jeon']}}).sort('-timestamp_modified').limit(5).then((rent)=>{
								Notice.find().then((notice)=>{
									res.render('home', {gallery: gallery, recommended: recommended, luxury:luxury,land:land,affordable:affordable,commercial:commercial,rent:rent,notice:notice});
								})
							})
						})
					})
				})
			})			
		})		
	})	
});

app.get("/test",(req,res)=>{
	res.render('test');
})

app.get("/list",(req,res)=>{
	let skipQuery = 0;
	if(req.query.skip){
		skipQuery = 20 + req.query.skip * 12;
	}
	let findQuery = {adon:'Y'};
	let listType = 'search';
	let fillSearchBox = JSON.stringify({});
	if(req.query.category){
		if(req.query.category === 'recommended'){
			findQuery.ad = 'recommended';
			listType = 'recommended';
		}else if(req.query.category==='urgent'){
			findQuery.ad = 'urgent';
			listType = 'urgent';
		}else if(req.query.category==='house'){
			findQuery.type = 'house'
			listType = 'house';
		}else if(req.query.category==='land'){
			findQuery.type = 'land';
			listType = 'land';
		}else if(req.query.category==='commercial'){
			findQuery.type = 'consumer';
			listType = 'commercial';
		}else if(req.query.category==='affordable'){
			findQuery.price_sell = {};
			findQuery.price_sell.$lte = 30000;
			findQuery.sell = 'sell';
			findQuery.type = {};
			findQuery.type.$in = ['house','villa'];
			listType = 'affordable';
		}else if(req.query.category==='midprice'){
			findQuery.price_sell = {};
			findQuery.price_sell.$lte = 60000;
			findQuery.price_sell.$gte = 30000;
			findQuery.type = {};
			findQuery.type.$in = ['house','villa'];
			findQuery.sell = 'sell';
			listType = 'midprice';
		}else if(req.query.category==='highprice'){
			findQuery.price_sell = {};
			findQuery.price_sell.$lte = 100000;
			findQuery.price_sell.$gte = 60000;
			findQuery.type = {};
			findQuery.type.$in = ['house','villa'];
			findQuery.sell = 'sell';
			listType = 'highprice';
		}else if(req.query.category==='luxury'){
			findQuery.price_sell = {};
			findQuery.price_sell.$gte = 100000;
			findQuery.type = {};
			findQuery.type.$in = ['house','villa'];
			findQuery.sell = 'sell';
			listType = 'luxury'
		}else if(req.query.category==='affordable_land'){
			findQuery.price_sell = {};
			findQuery.price_sell.$lte = 20000;
			findQuery.sell = 'sell';
			findQuery.type = 'land'
			listType = 'affordable_land';
		}else if(req.query.category === 'midprice_land'){
			findQuery.price_sell = {};
			findQuery.price_sell.$gte = 20000;
			findQuery.price_sell.$lte = 50000;
			findQuery.sell = 'sell';
			findQuery.type = 'land'
			listType = 'midprice_land';
		}else if(req.query.category === 'highprice_land'){
			findQuery.price_sell = {};
			findQuery.price_sell.$gte = 50000;
			findQuery.sell = 'sell';
			findQuery.type = 'land'
			listType = 'highprice_land';
		}
		else if(req.query.category==='sidebar_house'){
			findQuery.type = 'house';
			listType = 'sidebar_house';
		}
		else if(req.query.category==='sidebar_land'){
			findQuery.type = 'land';
			listType = 'sidebar_land';
		}else if(req.query.category==='sidebar_consumer'){
			findQuery.type = 'consumer';
			listType = 'sidebar_consumer';
		}else if(req.query.category==='sidebar_rent'){
			findQuery.type='rent';
			findQuery.sell = {};
			findQuery.sell.$in = ['rent','jeon'];
			listType='sidebar_rent';
		}else if(req.query.category==='sidebar_factory'){
			findQuery.type='factory';
			listType='sidebar_factory';
		}else if(req.query.category==='sidebar_villa'){
			findQuery.type='villa';
			listType='sidebar_villa';
		}
		else{
			// uuid query
			fillSearchBox = JSON.stringify(searchHistoryClient[req.query.category]);
			if(req.query.category && searchHistoryClient[req.query.category]){
				let sh = searchHistoryClient[req.query.category];
				if(sh.type){
					findQuery.type = {};
					findQuery.type.$in = sh.type;
				}
				if (sh.price_low || sh.price_high) {
					findQuery.price_sell = {};
					if (sh.price_high) findQuery.price_sell.$lte = Number(sh.price_high);
					if (sh.price_low) findQuery.price_sell.$gte = Number(sh.price_low);
				}
				if (sh.area_ground_high || sh.area_ground_low) {
					findQuery.area_ground = {};
					if (sh.area_ground_high) findQuery.area_ground.$lte = Number(sh.area_ground_high);
					if (sh.area_ground_low) findQuery.area_ground.$gte = Number(sh.area_ground_low);
				}
				if (sh.area_building_high || sh.area_building_low) {
					findQuery.area_building = {};
					if (sh.area_building_high) findQuery.area_building.$lte = Number(sh.area_building_high);
					if (sh.area_building_low) findQuery.area_building.$gte = Number(sh.area_building_low);
				}
				if(sh.theme){
					findQuery.theme = {};
					findQuery.theme.$all = sh.theme;
				}
				if(sh.recommended){
					if(sh.recommended.includes('전체선택')){

					}else {
						findQuery.detail_structure = {};
						if(sh.recommended.includes('기타')){
							if(Array.isArray(sh.recommended)){
								const idx = sh.recommended.indexOf('기타');
								sh.recommended.splice(idx,1);
							}else{
								sh.recommended = [];
							}
							let regexBuilder = '';
							for(let i = 0 ; i  < sh.recommended.length ; i++){
								if(sh.recommended[i]==='조적조'){
									regexBuilder = regexBuilder.concat('조적조|연와조|시멘트벽돌조|벽돌구조|')
								}else{
									regexBuilder = regexBuilder.concat(sh.recommended[i]+'|');
								}
							}
							regexBuilder = regexBuilder.concat('[^철근콘크리트|일반목구조|조적조|경량철골조]');
							//console.log(regexBuilder);
							findQuery.detail_structure = new RegExp(regexBuilder);
							findQuery.type="house";
						}else{
							if(typeof sh.recommended === 'string'){
								findQuery.detail_structure.$in = [];
								findQuery.detail_structure.$in.push(sh.recommended);
							}else{
								findQuery.detail_structure.$in = sh.recommended;
							}
							if(sh.recommended.includes('조적조')){
								findQuery.detail_structure.$in.push('연와조');
								findQuery.detail_structure.$in.push('시멘트벽돌조');
								findQuery.detail_structure.$in.push('벽돌구조');
							}
							if(sh.recommended.includes('일반목구조')){
								findQuery.detail_structure.$in.push('목조');
								findQuery.detail_structure.$in.push('목구조');
							}
						}
					}
				}
				if(sh.si){
					findQuery.address_si = new RegExp(sh.si);
				}
				if(sh.gun){
					findQuery.address_gun = new RegExp(sh.gun);
				}
				if(sh.up){
					findQuery.address_up = new RegExp(sh.up);
				}
				if(sh.location){
					if(sh.location.includes('기타지역')){
						if(Array.isArray(sh.location)){
							const idx = sh.location.indexOf('기타지역');
							sh.location.splice(idx,1);
							let regexBuilder = '';
							for(let i = 0 ; i < sh.location.length ; i++){
								regexBuilder = regexBuilder.concat(sh.location[i]+'|');
							}
							regexBuilder = regexBuilder.concat('[^강하면|강상면|양평읍|옥천면|양서면|서종면|용문면|지평면|개군면]');
							findQuery.address_up = new RegExp(regexBuilder);
						}else{
							findQuery.address_up = {};
							findQuery.address_up.$nin = ['강하면','강상면','양평읍','옥천면','양서면','서종면','용문면','지평면','개군면'];
						}
					}else{
						findQuery.address_up = {};
						findQuery.address_up.$in = sh.location;
					}
				}
				if(sh.id){
					findQuery.id = new RegExp(sh.id,'i');
				}
				if(sh.title){
					findQuery.title = new RegExp(sh.title,'i');
				}
			}
		}
	}
	// console.log(findQuery);
	let sortQuery = '';
	if (req.query.sort) {
		if (req.query.sort[req.query.sort.length - 3] === 'a') {
			sortQuery += req.query.sort.substr(0, req.query.sort.length - 4);
		} else {
			sortQuery = '-' + req.query.sort.substr(0, req.query.sort.length - 5);
		}
	}else{
		sortQuery = '-timestamp_modified';
	}

	let limitQuery = skipQuery===0? 24 : 12;
	Item.find(findQuery).sort(sortQuery).skip(skipQuery).limit(limitQuery).then((data)=>{
		if(skipQuery===0){
			Notice.find().then((notice)=>{
				res.render('list',{data:data, listType: listType, fillSearchBox: fillSearchBox, notice: notice});
			});
		} 
		else res.render('skip',{data:data});
	});
});

// use for client-side search query
app.post("/list",(req,res)=>{
	// console.log(req.body);
	let uuid = uuidv4();
	req.body.id = xss(req.body.id);
	req.body.title = xss(req.body.title);
	searchHistoryClient[uuid] = req.body;
	res.redirect('/list?category=' + uuid);
})

app.get("/item",(req,res)=>{
	let query = req.query.id;
	Item.find({_id:query}).then((data)=>{
		if(data.length===0){
			logger.info('access to invalid item ' + req.query.id);
			res.render('404');
		}else{
		data[0].detail = he.decode(data[0].detail).replace(/nbsp;/gi,'');
		data[0].views = data[0].views ? data[0].views + 1 : 0;
		Item.updateOne({_id: query}, data[0]).then(()=>{});
		Item.find({sell:data[0].sell, type: data[0].type}).limit(20).then((similar)=>{
			User.find({name:data[0].user}).then((user)=>{
				Notice.find().then((notice)=>{
					res.render('item',{data:data[0], similar: similar, user:user[0],notice:notice});
				})
			})
		})	
	}	
	})	
});

app.get("/login", (req, res) => {
	res.render('login');
});

app.post("/login", (req, res) => {	
	User.find({ name: req.body.name }).then((data) => {
		if (data.length === 0) {
			res.send("아이디가 존재하지 않습니다.");
		} else {
			bcrypt.compare(req.body.password, data[0].password, function (err, result) {
				if (result) {
					let token = jwt.sign({
						name: req.body.name
					},
					secretObj.secret,
					{
						expiresIn: "300m"
					});
					res.cookie("user", token);
					userInfo[token] = req.body.name;
					logger.info(req.body.name + ' logged in');
					res.redirect("/admin");
				} else {
					logger.info('wrong login attempt : ' + req.body.name + ' ' + req.body.password);
					res.send("비밀번호가 틀립니다.");
				}
			});
		}
	});
});

app.get("/admin", (req, res) => {
	// check for valid token
	if (jwtverify(req.cookies)) {	
		User.find({name:userInfo[req.cookies.user]}).then((info)=>{
			if(info.length===0) res.render("admin",{name:userInfo[req.cookies.user],permission:1});
			else res.render("admin", { name: userInfo[req.cookies.user], permission: info[0].permission });
		})	
	} else {
		logger.info('unauthorized accessto /admin GET');
		res.redirect("/login");
	}
});

app.get('/excel',(req,res)=>{
	let filename = req.cookies.excel;
	let stat = fs.statSync('excel/'+filename+'.xlsx');
	res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
	res.setHeader('Content-Length', stat.size);
	res.setHeader('Content-disposition', 'attachment; filename="excel.xlsx"');
	logger.info('excel file download : ' + fs.existsSync('excel/'+filename+'.xlsx'));
	res.download('excel/'+filename+'.xlsx','sonamu.xlsx');
})

app.get("/manage", (req, res) => {
	if (jwtverify(req.cookies)) {
		let pages = 0;
		let sort = "";
		let itemsNumber = 30;
		// build search query
		let userQuery;
		let permission;
		let sharedItem = {share:'Y'};
		User.find({name:userInfo[req.cookies.user]}).then((info)=>{
			permission = info[0].permission;
			if(permission===2){
				userQuery = new RegExp('[\s\S]*');
			}else if(permission===1){
				userQuery = userInfo[req.cookies.user];
			}else{
				userQuery = userInfo[req.cookies.user];
				sharedItem = {id:"tesautus132"};
			}
	
	
			let uuid = req.query.search;
			let findQuery = {};
			if (uuid && searchHistory[uuid]) {
				let sh = searchHistory[uuid];
				if (sh.id) findQuery.id = new RegExp(sh.id,'i');
				if (sh.contract) findQuery.contract = sh.contract;
				if (sh.adon) findQuery.adon = sh.adon;
				if (sh.title) findQuery.title = new RegExp(sh.title,'i');
				if (sh.memo) findQuery.memo = new RegExp(sh.memo,'i');
				if (sh.sell) findQuery.sell = sh.sell;
				if (sh.type) findQuery.type = sh.type;
				if (sh.address_up) findQuery.address_up = new RegExp(sh.address_up,'i');
				if (sh.price_sell_upper || sh.price_sell_lower) {
					findQuery.price_sell = {};
					if (sh.price_sell_upper) findQuery.price_sell.$lte = Number(sh.price_sell_upper);
					if (sh.price_sell_lower) findQuery.price_sell.$gte = Number(sh.price_sell_lower);
				}
				if (sh.price_jeon_upper || sh.price_jeon_lower) {
					findQuery.price_jeon = {};
					if (sh.price_jeon_upper) findQuery.price_jeon.$lte = Number(sh.price_jeon_upper);
					if (sh.price_jeon_lower) findQuery.price_jeon.$gte = Number(sh.price_jeon_lower);
				}
				if (sh.detail_structure) findQuery.detail_structure = new RegExp(sh.detail_structure,'i');
				if (sh.area_ground_upper || sh.area_ground_lower) {
					findQuery.area_ground = {};
					if (sh.area_ground_upper) findQuery.area_ground.$lte = Number(sh.area_ground_upper);
					if (sh.area_ground_lower) findQuery.area_ground.$gte = Number(sh.area_ground_lower);
				}
				if (sh.area_building_upper || sh.area_building_lower) {
					findQuery.area_building = {};
					if (sh.area_building_upper) findQuery.area_building.$lte = Number(sh.area_building_upper);
					if (sh.area_building_lower) findQuery.area_building.$gte = Number(sh.area_building_lower);
				}
				if (sh.price_deposit_upper || sh.price_deposit_lower) {
					findQuery.price_deposit = {};
					if (sh.price_deposit_upper) findQuery.price_deposit.$lte = Number(sh.price_deposit_upper);
					if (sh.price_deposit_lower) findQuery.price_deposit.$gte = Number(sh.price_deposit_lower);
				}
				if (sh.price_rent_upper || sh.price_rent_lower) {
					findQuery.price_rent = {};
					if (sh.price_rent_upper) findQuery.price_rent.$lte = Number(sh.price_rent_upper);
					if (sh.price_rent_lower) findQuery.price_rent.$gte = Number(sh.price_rent_lower);
				}
				if (sh.detail_date) findQuery.detail_date = sh.detail_date;
				if (sh.detail_orientation) findQuery.detail_orientation = sh.detail_orientation;
				if (sh.area_rooms_upper || sh.area_rooms_lower) {
					findQuery.area_rooms = {};
					if (sh.area_rooms_upper) findQuery.area_rooms.$lte = Number(sh.area_rooms_upper);
					if (sh.area_rooms_lower) findQuery.area_rooms.$gte = Number(sh.area_rooms_lower);
				}
				if (sh.area_toilets_upper || sh.area_toilets_lower) {
					findQuery.area_toilets = {};
					if (sh.area_toilets_upper) findQuery.area_toilets.$lte = Number(sh.area_toilets_upper);
					if (sh.area_toilets_lower) findQuery.area_toilets.$gte = Number(sh.area_toilets_lower);
				}
				if (sh.ad) findQuery.ad = sh.ad;
				if (sh.timestamp_modified_upper || sh.timestamp_modified_lower) {
					findQuery.timestamp_modified = {};
					if (sh.timestamp_modified_upper) findQuery.timestamp_modified.$lte = Number(new Date(sh.timestamp_modified_upper).getTime());
					if (sh.timestamp_modified_lower) findQuery.timestamp_modified.$gte = Number(new Date(sh.timestamp_modified_lower).getTime());
				}
				if (sh.timestamp_upper || sh.timestamp_lower) {
					findQuery.timestamp = {};
					if (sh.timestamp_upper) findQuery.timestamp.$lte = Number(new Date(sh.timestamp_upper).getTime());
					if (sh.timestamp_lower) findQuery.timestamp.$gte = Number(new Date(sh.timestamp_lower).getTime());
				}
				if (sh.views_upper || sh.area_views_lower) {
					findQuery.views = {};
					if (sh.views_upper) findQuery.views.$lte = Number(sh.views_upper);
					if (sh.views_lower) findQuery.views.$gte = Number(sh.views_lower);
				}
			}

			if(req.query.number) {
				itemsNumber = Number(req.query.number);
			}
			let sortQuery = req.query.sort;
			if (req.query.page) pages = req.query.page - 1;
			if (sortQuery) {
				if (sortQuery[sortQuery.length - 3] === 'a') {
					sort = '-' + sortQuery.substr(0, sortQuery.length - 4);
				} else {
					sort += sortQuery.substr(0, sortQuery.length - 5);
				}
			}else{
				sort = '-timestamp_modified';
			}
	
			// TODO : querystring 인자 삽입해서 전달, 렌더링에서 링크 추가
			Item.find(findQuery).or([sharedItem,{share:'N',user:userQuery}]).sort(sort).skip(itemsNumber * pages).limit(itemsNumber).then((data) => {
				for (let i = 0; i < data.length; i++) {
					if (data[i]) {
						data[i].contract = util.findContract(data[i].contract);
						data[i].sell = util.findSell(data[i].sell);
						data[i].type = util.findType(data[i].type);
						data[i].ad = util.findAd(data[i].ad);
					}
				}
	
				if(req.cookies.excel){
					fs.unlink('excel/'+req.cookies.excel+'.xlsx',function(){
					})
				}
				let excel_uuid = uuidv4();
	
				Item.find(findQuery).or([sharedItem,{share:'N',user:userQuery}]).sort(sort).skip(itemsNumber * pages).limit(itemsNumber).then((data2) => {
					let ws_data = [
						["매물번호","계약","광고","광고제목","관리설명","형태","매물종류","광고해당동","매매가","전세가","건축구조","광고대지평","광고평수","보증금","월세","준공년도","방향","방수","욕실","광고종류","수정일","등록일","조회"]
					];
					let cols = [];
					for(let i = 0 ; i < 23 ; i++){
						let w = 10;
						if(i===3 || i===4) w = 40;
						if(i===6 ) w = 15;
						if(i===20 || i===21) w = 13;
						if(i===19) w = 16;
						let tmp = {
							hidden: false,
							wpx: w,
							width: w,
							wch: w,
						}
						cols.push(tmp);
					}
					for(let i = 0 ; i < data2.length ; i++){
						if (data2[i]) {
							data2[i].contract = util.findContract(data2[i].contract);
							data2[i].sell = util.findSell(data2[i].sell);
							data2[i].type = util.findType(data2[i].type);
							data2[i].ad = util.findAd(data2[i].ad);
						}
						ws_data.push([data2[i].id,data2[i].contract,data2[i].adon,data2[i].title,data2[i].memo,data2[i].sell,data2[i].type,data2[i].address_up,data2[i].price_sell,data2[i].price_jeon,data2[i].area_recommended,data2[i].area_ground,data2[i].area_building,data2[i].price_deposit,data2[i].price_rent,data2[i].detail_date,data2[i].detail_orientation,data2[i].area_rooms,data2[i].area_toilets,data2[i].ad.toString(),new Date(data2[i].timestamp_modified).toISOString().split('T')[0],new Date(data2[i].timestamp).toISOString().split('T')[0],data2[i].views]);
					}
					let workbook = XLSX.utils.book_new();
					let worksheet = XLSX.utils.aoa_to_sheet(ws_data);
					worksheet['!cols'] = cols;
					XLSX.utils.book_append_sheet(workbook,worksheet,'Sheet1');
					XLSX.writeFile(workbook, 'excel/' + excel_uuid + '.xlsx');
				
					Item.find(findQuery).or([sharedItem,{share:'N',user:userQuery}]).count((err, result) => {
						if (uuid === undefined) uuid = "";
						res.cookie('excel',excel_uuid);
						res.render("manage", { searchHistory: JSON.stringify(searchHistory[uuid]), uuid: uuid, data: data, count: result, current: pages });
					})
				});
			})
		});
	} else {
		logger.info('unauthorized access to /manage GET');
		res.render("unauthorized");
	}
});

app.post("/search", (req, res) => {
	let uuid = uuidv4();
	searchHistory[uuid] = req.body;
	res.redirect('/manage?search=' + uuid);
});

app.post("/delete", (req, res) => {
	if (jwtverify(req.cookies)) {
		let items = req.body.deleteitems.split(",");
		for (let i of items) {
			mongooseIO.deleteItem(i);
			logger.info('delete item ' + i);
		}
		setTimeout(()=>{res.redirect('/manage');},500);
	} else {
		logger.info('unauthorized access to /delete POST');
		res.send('권한이 없습니다.');
	}
})

async function makeID2(region){
	let result = [];
	switch(region){
	   case '강하면':
		   result.push('A');
		   break;
	   case '강상면':
		   result.push('B');
		   break;
	   case '청운면':
		   result.push('C');
		   break;
	   case '용문면':
		   result.push('D');
		   break;
	   case '양동면':
		   result.push('E');
		   break;
	   case '양서면':
		   result.push('W');
		   break;
	   case '서종면':
		   result.push('S');
		   break;
	   case '단월면':
		   result.push('M');
		   break;
	   case '개군면':
		   result.push('K');
		   break;
	   case '양평읍':
		   result.push('Y');
		   break;
	   case '지평면':
		   result.push('J');
		   break;
	   case '옥천면':
		   result.push('O');
		   break;
	   case '퇴촌면':
		   result.push('T');
		   break;
	   case '남종면':
		   result.push('N');
		   break;
	   default:
		   result.push('F');
		   break;
   }
   let done = false;
   let idNumber = -1;
	await Item.find({id_letter : result[0]}).then((data)=>{
		for(let i = 0 ; i < data.length ; i++){
			if(Number(data[i].id_number) > idNumber){
				idNumber = Number(data[i].id_number);
			}
		}
	});
   if(idNumber === -1) Math.floor(Math.random()*100000 + 10001);
   result.push(idNumber+1);
   return result;
}

app.post('/duplicate', (req,res)=>{
	if(jwtverify(req.cookies)){
		let items = req.body.duplicateitems.split(",");
		for(let i of items){
			Item.find({_id:i}).lean().then( async (data)=>{
				delete data[0].id;
				const test = await makeID2(data[0].address_up);
				data[0].id_letter = test[0];
				data[0].id_number = test[1];
				data[0].id = data[0].id_letter + data[0].id_number;
				data[0].timestamp_modified = new Date().getTime();
				delete data[0]._id;
				let newimage = [];
				for(let j = 0 ; j < data[0].image.length ; j++){
					if(path.parse(data[0].image[j]).ext===''){
						newimage.push(data[0].image[j]+'d');
						fs.copyFileSync('./public/images'+data[0].image[j],'./public/images'+data[0].image[j]+'d');
					}else{
						newimage.push(path.parse(data[0].image[j]).dir + '/' + path.parse(data[0].image[j]).name+'d' + path.parse(data[0].image[j]).ext);
						fs.copyFileSync('./public/images'+data[0].image[j],'./public/images'+path.parse(data[0].image[j]).dir + '/' + path.parse(data[0].image[j]).name+'d' + path.parse(data[0].image[j]).ext);
					}
				}
				let newimage2 = [];
				for(let j = 0 ; j < data[0].image2.length ; j++){
					if(path.parse(data[0].image2[j]).ext===''){
						newimage2.push(data[0].image2[j]+'d');
						fs.copyFileSync('./public/images'+data[0].image2[j],'./public/images'+data[0].image2[j]+'d');
					}else{
						newimage2.push(path.parse(data[0].image2[j]).dir + '/' + path.parse(data[0].image2[j]).name+'d' + path.parse(data[0].image2[j]).ext);
						fs.copyFileSync('./public/images'+data[0].image2[j],'./public/images'+path.parse(data[0].image2[j]).dir + '/' + path.parse(data[0].image2[j]).name+'d' + path.parse(data[0].image2[j]).ext);
					}
				}
				if(newimage.length!==0){
					fs.copyFileSync('./public/images'+data[0].thumbnail,'./public/images'+ data[0].thumbnail+'d');
					const tmp = data[0].thumbnail;
					delete data[0].thumbnail;
					data[0].thumbnail = tmp + 'd';
				}
				delete data[0].image;
				data[0].image = newimage;
				delete data[0].image2;
				data[0].image2 = newimage2;
				const item = new Item(data[0]);
				item.save().then(()=>{logger.info('duplicate ' + i)}).catch((err)=>{console.log(err)});
			})
		}
		setTimeout(()=>{res.redirect('/manage');},1000)
	}else{
		logger.info('unauthorized access to /duplicate POST');
		res.send('권한이 없습니다.');
	}
})

app.get('/lab',(req,res)=>{
	res.render('lab');
});

app.post('/lab', upload.array('images'), (req,res)=>{
	console.log('/lab POST');
	console.log(req.files);
	if(typeof req.files === 'undefined') req.files=[];
	for(let i = 0 ; i < req.files.length ; i++) {
		console.log(req.files[i].filename);
	}
	res.redirect('/lab');
});

app.get("/register", (req, res) => {
	if (jwtverify(req.cookies)) {
		User.find().then((info)=>{
			res.render("register",{user: info});
		})
	} else {
		logger.info('unauthorized access to /register GET');
		res.render("unauthorized");
	}
});

app.post('/registerimage2',upload.array('image',100),(req,res)=>{
	setTimeout(()=>{
		let fileInput = [];
		if(typeof req.files==='undefined') req.files=[];
		for(let i = 0 ; i < req.files.length ; i++){
			if(req.files[i]) fileInput.push('/' + req.files[i].filename);
		}
		Item.find().sort('-timestamp').limit(1).then((data)=>{
			data[0].image2 = fileInput;
			Item.updateOne({_id:data[0]._id},data[0]).then(()=>{}).catch((err)=>{console.log(err)});
		})
	},800);
});

app.post("/registerimage",upload.array('image',100),(req,res)=>{
	console.log('registerimage POST');
	let thumbnailExists = false;
	let fileInput = [];
	if(typeof req.files==='undefined') req.files=[];
	for(let i = 0 ; i < req.files.length ; i++){
		if(req.files[i]) fileInput.push('/'+req.files[i].filename);
	}
	setTimeout(()=>{
		Item.find().sort('-timestamp').limit(1).then((data)=>{
			data[0].image = fileInput;
			data[0].thumbnail = fileInput.length===0? '' : '/thumbnail' + fileInput[0];
			if(fileInput.length!==0) thumbnailExists = true;
			Item.updateOne({_id:data[0]._id},data[0]).then(()=>{}).catch((err)=>{console.log(err)})
		})
	},500);
	setTimeout(()=>{
		if(thumbnailExists){
			if(fs.existsSync('./public/images/thumbnailtemp')) fs.unlinkSync('./public/images/thumbnailtemp');
			fs.copyFile('./public/images'+fileInput[0],'./public/images/thumbnailtemp',(e)=>{
				sharp('./public/images'+fileInput[0]).resize({fit:'fill',width:233,height:165})
				.toFile('./public/images/thumbnail'+fileInput[0],(err,info)=>{
					if(err){
						fs.unlink('./public/images'+fileInput[0],(b)=>{
							fs.rename('./public/images/thumbnailtemp','./public/images'+fileInput[0],(a)=>{
								if(fs.existsSync('./public/images/thumbnail'+fileInput[0])){
									fs.unlink('./public/images/thumbnail'+fileInput[0],(d)=>{
										fs.copyFile('./public/images'+fileInput[0],'./public/images/thumbnail'+fileInput[0],(z)=>{});
									})
								}
							})
						})							
					}else{
						fs.unlink('./public/images/thumbnailtemp',(a)=>{});
					}
				});
			})				
		}
	},1000);
	setTimeout(()=>{
		let loopArray = function(x){
			if(x===fileInput.length){
				return;
			}else{
				if(fs.existsSync('./public/images/temp')){
					fs.unlinkSync('./public/images/temp');
				}
				fs.copyFile('./public/images'+fileInput[x],'./public/images/temp',()=>{
					fs.rename('./public/images'+fileInput[x],'./public/images'+fileInput[x]+'2',(err)=>{
						sharp('./public/images'+fileInput[x]+'2').resize({fit:'fill',width:950,height:550})
						.toFile('./public/images'+fileInput[x],(err,info)=>{
							if(err){
								logger.info(err);
								if(fs.existsSync('./public/images'+fileInput[x])) fs.unlinkSync('./public/images'+fileInput[x]);
								fs.unlinkSync('./public/images'+fileInput[x]+'2');
								fs.rename('./public/images/temp','./public/images'+fileInput[x],()=>{loopArray(x+1)});
							}else{
								fs.unlinkSync('./public/images'+fileInput[x]+'2');
								fs.unlink('./public/images/temp',()=>{loopArray(x+1)});
							}
						})
					})						
				})
			}
		}
		loopArray(0);
	},20000);
});

async function makeID(region){
	 let result = [];
	 switch(region){
		case '강하면':
			result.push('A');
			break;
		case '강상면':
			result.push('B');
			break;
		case '청운면':
			result.push('C');
			break;
		case '용문면':
			result.push('D');
			break;
		case '양동면':
			result.push('E');
			break;
		case '양서면':
			result.push('W');
			break;
		case '서종면':
			result.push('S');
			break;
		case '단월면':
			result.push('M');
			break;
		case '개군면':
			result.push('K');
			break;
		case '양평읍':
			result.push('Y');
			break;
		case '지평면':
			result.push('J');
			break;
		case '옥천면':
			result.push('O');
			break;
		case '퇴촌면':
			result.push('T');
			break;
		case '남종면':
			result.push('N');
			break;
		default:
			result.push('F');
			break;
	}
	
	let idNumber = -1;
	 await Item.find({id_letter : result[0]}).then((data)=>{
		 for(let i = 0 ; i < data.length ; i++){
			 if(Number(data[i].id_number) > idNumber){
				 idNumber = Number(data[i].id_number);
			 }
		 }
	 });
	if(idNumber === -1) Math.floor(Math.random()*100000 + 10001);
	result.push(idNumber+1);
	return result;
 }

// upload.array('image', 100), 
app.post("/register", async (req, res) => {
	if(!fs.existsSync('./public/images/thumbnail')){
		fs.mkdirSync('./public/images/thumbnail');
	}
	if (jwtverify(req.cookies)) {
		// console.log(req.body);
		req.body.id = req.body.id_letter + req.body.id_number;
		if(req.body.randomId){
			let test = await makeID(req.body.address_up);
			req.body.id_letter = test[0];
			req.body.id_number = test[1];
			req.body.id = req.body.id_letter + req.body.id_number;
		}
		if(req.body.area_ground && req.body.area_ground2 === ''){
			//console.log('hello');
			req.body.area_ground2 = Math.round(req.body.area_ground * 3.3058);
		}
		if(req.body.area_ground2 && req.body.area_ground === ''){
			//console.log('hello2');
			req.body.area_ground = Math.round(req.body.area_ground2 * 0.3025);
		}
		if(req.body.area_building && req.body.area_building2 === ''){
			//console.log('hello3');
			req.body.area_building2 = Math.round(req.body.area_building * 3.3058);
		}
		if(req.body.area_building2 && req.body.area_building === ''){
			//console.log('hello4');
			req.body.area_building = Math.round(req.body.area_building2 * 0.3025);
		}
		if(req.body.area_ground && req.body.price_sell){
			req.body.price_unit = Math.round(req.body.price_sell/req.body.area_ground);
		}
		req.body.gallery = he.encode(req.body.gallery);
		req.body.detail = he.encode(req.body.detail);
		if (req.body.icon === undefined) req.body.icon = "";
		if (req.body.ad === undefined) req.body.ad = "";
		if (req.body.theme === undefined) req.body.theme = "";
		if (req.body.price_jeon === undefined) req.body.price_jeon = "";
		if (req.body.price_unit === undefined) req.body.price_unit = "";
		if (req.body.views === undefined) req.body.views = 0;
		req.body.timestamp_modified = new Date().getTime();
		req.body.timestamp = new Date().getTime();		
		const item = new Item(req.body);
		item.save().then(()=>{
			logger.info('item saved!!');
		}).catch((err)=>console.log(err));
		setTimeout(()=>{
			res.redirect("/manage");
		},10000);		
	} else {
		logger.info('unauthorized access to /register');
		res.render("unauthorized");
	}
});

app.get("/stats", (req, res) => {
	if (jwtverify(req.cookies)) {
		Stat.find({name: 'total'}).then((today)=>{
			if(today.length===0){
				let stat = new Stat({name:'total',count:0});
				stat.save().then(()=>{});
			}
			Stat.find({name:'today'}).sort('-timestamp').limit(20).then((timestamp)=>{
				Stat.find({name:'mobile'}).then((mobile)=>{
					if(mobile.length===0) mobile = [{name:'mobile',count:0}];
					Stat.find({name:'desktop'}).then((desktop)=>{
						if(desktop.length===0) desktop = [{name:'desktop',count: 0}];
						res.render('stats',{today: today[0], timestamp: timestamp, mobile: mobile[0], desktop: desktop[0]})
					})
				})
			})
			
		})
	} else {
		logger.info('unauthorized access to /stats GET');
		res.render("unauthorized");
	}
});

app.post("/stats", (req, res) => {

})

app.post('/detailsimage2',upload.array('image',100),(req,res)=>{
	console.log('/detailsimage2');
	if(jwtverify(req.cookies)){
		let newFilelist = req.body.uploadFilelist2.split(',');
		let count = 0;
		for(let i = 0 ; i < newFilelist.length ; i++){
			if(newFilelist[i].length===0){
				if(req.files[count]) newFilelist[i] = '/' + req.files[count].filename; // problem when empty
				count++;
			}
		}

		Item.find({_id:req.body._id}).then((data)=>{
			let originalImage = [];
			for(let i = 0 ; i < data[0].image2.length ; i++){
				originalImage.push(data[0].image2[i]);
			}
			let newImage = newFilelist;
			for(let i = 0 ; i < newImage.length ; i++){
				if(originalImage.indexOf(newImage[i])!==-1){
					originalImage.splice(originalImage.indexOf(newImage[i]),1);
				}
			}
			for(let i = 0 ; i < originalImage.length ; i++){
				if(fs.existsSync('./public/images' + originalImage[i])) fs.unlinkSync('./public/images'+originalImage[i]);
			}
			setTimeout(()=>{
				data[0].image2 = newFilelist;
				console.log('/detailsimage2 before updateOne')
				Item.updateOne({_id: req.body._id},data[0]).then(()=>{console.log('/detailsimage2 after updateOne')}).catch((err)=>{console.log(err)});
			},1000);
		});
	}else{
		res.send('unauthorized');
	}
});

app.post('/detailsimage',upload.array('image',100),(req,res)=>{
	console.log('/detailsimage');
	if(jwtverify(req.cookies)){
		//console.log(req.files);
		// console.log(req.body);
		let newFilelist = req.body.uploadFilelist.split(',');
		//console.log(newFilelist);
		let count = 0;
		for(let i = 0 ; i < newFilelist.length ; i++){
			if(newFilelist[i].length===0){
				if(req.files[count]) newFilelist[i] = '/'+ req.files[count].filename; // problem when empty
				count++;
			}
		}
		// console.log(newFilelist);
		Item.find({_id:req.body._id}).then((data)=>{
			// console.log(newFilelist);
			let originalImage = [];
			for(let i = 0 ; i < data[0].image.length ; i++){
				originalImage.push(data[0].image[i]);
			}
			let newImage = newFilelist;
			for(let i = 0 ; i < newImage.length ; i++){
				if(originalImage.indexOf(newImage[i])!==-1){
					originalImage.splice(originalImage.indexOf(newImage[i]),1);
				}
			}
			// console.log(originalImage);
			for(let i = 0 ; i < originalImage.length ; i++){
				if(fs.existsSync('./public/images'+originalImage[i])) fs.unlinkSync('./public/images' + originalImage[i]);
			}
			// console.log(data[0].image[0] + ' ' + newFilelist[0]);
			if(data[0].image[0]!==newFilelist[0]){
				console.log('thumbnail creation');
				if(fs.existsSync('./public/images/thumbnail'+data[0].image[0])) fs.unlinkSync('./public/images/thumbnail'+data[0].image[0]);
				setTimeout(()=>{
					data[0].thumbnail = newFilelist[0];
					if(fs.existsSync('./public/images/thumbnailtemp')) fs.unlinkSync('./public/images/thumbnailtemp');
					fs.copyFile('./public/images'+newFilelist[0],'./public/images/thumbnailtemp',(e)=>{
						sharp('./public/images'+newFilelist[0]).resize({fit:'fill',width:233,height:165})
						.toFile('./public/images/thumbnail'+newFilelist[0],(err,info)=>{
							if(err){
								fs.unlink('./public/images'+newFilelist[0],(b)=>{
									fs.rename('./public/images/thumbnailtemp','./public/images'+newFilelist[0],(a)=>{
										if(fs.existsSync('./public/images/thumbnail'+newFilelist[0])){
											fs.unlink('./public/images/thumbnail'+newFilelist[0],(d)=>{
												fs.copyFile('./public/images'+newFilelist[0],'./public/images/thumbnail'+newFilelist[0],(z)=>{});
											})
										}
									})
								})							
							}else{
								fs.unlink('./public/images/thumbnailtemp',(a)=>{});
							}
						});
					})
					data[0].image = newFilelist;
					console.log('/detailsimage updateOne');
					Item.updateOne({_id:req.body._id},data[0]).then(()=>{console.log('/detailsImage updateOne done')}).catch((err)=>{console.log(err)});
				},500);
			}else{
				setTimeout(()=>{
					data[0].image = newFilelist;
					console.log('/detailsimage updateOne');
					Item.updateOne({_id:req.body._id},data[0]).then(()=>{console.log('/detailsImage updateOne done')}).catch((err)=>{console.log(err)});
				},500);
			}
		})
	}else{
		res.render('unauthorized');
	}
});

app.get("/details", (req, res) => {
	if (jwtverify(req.cookies)) {
		Item.find({ _id: req.query.id }).then((data) => {
			data[0].detail = he.decode(data[0].detail).replace(/&nbsp;/gi,'').replace(/&amp;/gi,'');
			data[0].gallery = he.decode(data[0].gallery).replace(/&nbsp;/gi,'').replace(/&amp;/gi,'');
			User.find().then((info)=>{
				res.render('details', { data: JSON.stringify(data), user: info });
			})
		})
	} else {
		logger.info('unauthorized access to /details GET');
		res.render('unauthorized');
	}
})


app.post("/details", (req, res) => {
	console.log('/details');
	if(!fs.existsSync('./public/images/thumbnail')){
		fs.mkdirSync('./public/images/thumbnail');
	}
	if (jwtverify(req.cookies)) {
		Item.find({_id:req.body.query_id}).then((data)=>{
			let currentItem = req.body.query_id;
			delete req.body.query_id;
			console.log(req.body);
			// req.body.timestamp_modified = new Date().getTime();
			req.body.gallery = he.encode(req.body.gallery);
			req.body.detail = he.encode(req.body.detail);
			req.body.id = req.body.id_letter + req.body.id_number;
			
			if(req.body.area_ground && req.body.area_ground2 === ''){
				//console.log('hello');
				req.body.area_ground2 = Math.round(req.body.area_ground * 3.3058);
			}
			if(req.body.area_ground2 && req.body.area_ground === ''){
				//console.log('hello2');
				req.body.area_ground = Math.round(req.body.area_ground2 * 0.3025);
			}
			if(req.body.area_building && req.body.area_building2 === ''){
				//console.log('hello3');
				req.body.area_building2 = Math.round(req.body.area_building * 3.3058);
			}
			if(req.body.area_building2 && req.body.area_building === ''){
				//console.log('hello4');
				req.body.area_building = Math.round(req.body.area_building2 * 0.3025);
			}
			if(req.body.area_ground && req.body.price_sell){
				req.body.price_unit = Math.round(req.body.price_sell/req.body.area_ground);
			}
			// console.log('/details before updateOne');
			Item.updateOne({ _id: currentItem }, req.body)
				.then(() => { 
					logger.info('updated ' + req.body.id);
					// console.log('/details after updateOne');
				})
				.catch((err) => { logger.info(err); });
	
			setTimeout(()=>{
				res.redirect('/manage');
			},6000);
			// setTimeout(()=>{
			// 	if(deleteFile.length!=0){
			// 		sharp('./public/images'+imageref[0])
			// 		.resize(233,165).toFile('./public/images/thumbnail'+imageref[0],(err, info)=>{logger.info(err);});
			// 	}
			// },5000);
		})
	} else {
		logger.info('unauthorized access to /details POST');
		res.send("권한이 없습니다.");
	}
})

app.post('/createuser',(req,res)=>{
	// console.log(req.body);
	User.find({name:req.body.name}).then((info)=>{
		if(info.length===0){
			if(req.body.name.length===0) req.body.name = ' ';
			if(req.body.explanation.length===0) req.body.explanation = ' ';
			if(req.body.phone.length===0) req.body.phone = ' ';
			if(req.body.password.length===0){
				req.body.password = '3756';
			}
				bcrypt.genSalt(10, function (err, salt) {
					bcrypt.hash(req.body.password, salt, function (err, hash) {
						const user = new User({
							name: req.body.name,
							password: hash,
							explanation: req.body.explanation,
							phone: req.body.phone,
							permission: Number(req.body.permission),
						});
						user
							.save()
							.then(() => {logger.info("new user " + req.body.name + ' registered');console.log('new user...')})
							.catch((err) => console.log("error : " + err));
					});
				});
		}else{
			let u_explanation = info[0].explanation;
			let u_password = info[0].password;
			let u_phone = info[0].phone;
			let u_permission = info[0].permission;
			if(req.body.explanation.length!==0 && info[0].explanation!=req.body.explanation){
				u_explanation = req.body.explanation;
			}
			if(req.body.phone.length!==0 && info[0].phone!=req.body.phone){
				u_phone = req.body.phone;
			}
			if(Number(req.body.permission)!==info[0].permission){
				u_permission = Number(req.body.permission);
			}
			if(req.body.password.length!==0){
				bcrypt.compare(req.body.password, info[0].password, function(err,result){
					if(!result){
						bcrypt.genSalt(10,function(err,salt2){
							bcrypt.hash(req.body.password,salt2,function(err,hash2){
								u_password = hash2;
							})
						})
					}
				})
			}
			setTimeout(()=>{
				info[0].password = u_password;
				info[0].explanation = u_explanation;
				info[0].phone = u_phone;
				info[0].permission = u_permission;
				User.updateOne({_id:info[0]._id},info[0]).then(()=>{
					console.log('updated...');
				}).catch((err)=>{console.log(err);})
			},500);
		}
		setTimeout(()=>{
			res.redirect('/user');
		},1000);
	})
})

app.get('/notice',(req,res)=>{
	User.find({name:userInfo[req.cookies.user]}).then((info)=>{
		if(jwtverify(req.cookies)&&info[0].permission===2){
			Notice.find().then((notice)=>{
				res.render('notice',{notice:notice});
			})
		}else{
			res.render('unauthorized');
		}
	})
})

app.post('/renewnotice',(req,res)=>{
	let newItem = req.body.content.split(',');
	Notice.remove().then(()=>{
		for(let i = 0 ; i < newItem.length ; i++){
			mongooseIO.postNotification(newItem[i]);
		}
		res.redirect('/admin');
	})
})

app.post('/changedate',(req,res)=>{
	if(jwtverify(req.cookies)){
		let items = req.body.changedate.split(',');
		for(let i of items){
			Item.find({_id: i}).then((data)=>{
				data[0].timestamp_modified = new Date().getTime();
				Item.updateOne({_id: i},data[0]).then(()=>{'change date : ' + i});
			})
		}
		setTimeout(()=>{
			res.redirect('/manage');
		},500);
	}else{

	}
});

app.post('/deleteuser',(req,res)=>{
	if(jwtverify(req.cookies)){
		let items = req.body.deleteitems.split(",");
		for(let i of items){
			User.deleteOne({_id:i}).then(()=>{logger.info('delete ID ' + i)});
		}
		setTimeout(()=>{
			res.redirect('/user');
		},500);
	}else{
		logger.info('unauthoried access to /deleteuser POST');
		res.send('권한이 없습니다.');
	}
})

app.post('/moveuser',(req,res)=>{
	console.log(req.body);
	Item.find({user:req.body.from}).then((data)=>{
		for(let i = 0 ; i < data.length ; i++){
			data[i].user = req.body.to;
			Item.updateOne({_id:data[i]._id},data[i]).then(()=>{}).catch((err)=>{logger.info(err)});
		}
	})
	setTimeout(()=>{
		res.redirect('/user')
	},500);
})

app.get("/about",(req,res)=>{
	Notice.find().then((notice)=>{
		res.render('about',{notice:notice});
	})	
});

app.get("/location",(req,res)=>{
	Notice.find().then((notice)=>{
		res.render('location',{notice:notice});
	})	
});

app.get("/tos",(req,res)=>{
	Notice.find().then((notice)=>{
		res.render('tos',{notice:notice});
	})	
});

app.get("/privacy",(req,res)=>{
	Notice.find().then((notice)=>{
		res.render('privacy',{notice:notice});
	})	
});

app.get("/responsibility",(req,res)=>{
	Notice.find().then((notice)=>{
		res.render('responsibility',{notice:notice});
	})	
});

app.get("/user",(req,res)=>{
	User.find({name:userInfo[req.cookies.user]}).then((info)=>{
		if(jwtverify(req.cookies)&&info[0].permission===2){
			User.find().then((user)=>{
				res.render('user',{user:user});
			})
		}else{
			res.render('unauthorized');
		}
	})
})

app.post('/footer',(req,res)=>{
	console.log(req.body);
	if(req.body.password==='26980'){
		Item.find({_id:req.body.item}).then((data)=>{
			res.send(data[0].memo);
		})
	}else{
		res.send('비밀번호가 틀립니다.');
	}
});

app.use(express.static('public'));

app.listen(3001, () => {
	logger.info('started app.js server from port 3001')
	console.log('start app.js');
});

mongoose.connect(
	"mongodb://localhost/sonamu",
	{ useNewUrlParser: true, useUnifiedTopology: true },
	() => {
		logger.info("connected to DB");
		console.log('connected to DB');
	}
);

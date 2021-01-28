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
		permittedPolicied: "none",
	})
);

app.disable('x-powered-by');


let searchHistory = {};
let searchHistoryClient = {};
let userInfo = {};

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
	Location.find({si:req.query.name}).then((data)=>{
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
	Location.find({gun:req.query.name}).then((data)=>{
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

					}else{
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
								regexBuilder = regexBuilder.concat(sh.recommended[i]+'|');
							}
							regexBuilder = regexBuilder.concat('[^철근콘크리트|일반목구조|조적조|경량철골조]');
							//console.log(regexBuilder);
							findQuery.detail_structure = new RegExp(regexBuilder);
						}else{
							findQuery.detail_structure.$in = sh.recommended;
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
							regexBuilder = regexBuilder.concat('[^강하면|강상면|양평읍|옥천면|양서면|서종면|용문면|지평면|개군면|청운면|단월면|양동면|퇴촌면|남종면]');
							findQuery.address_up = new RegExp(regexBuilder);
						}else{
							findQuery.address_up = {};
							findQuery.address_up.$nin = ['강하면','강상면','양평읍','옥천면','양서면','서종면','용문면','지평면','개군면','청운면','단월면','양동면','퇴촌면','남종면'];
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
		if(skipQuery===0) res.render('mobile',{data:data, listType: listType});
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
			gallery[i].detail = he.decode(gallery[i].detail);
		}
		Item.find({adon: 'Y', ad:'recommended'}).limit(10).then((recommended)=>{
			Item.find({adon: 'Y', sell:'sell',type:'house',price_sell:{$gte : 100000}}).limit(10).then((luxury)=>{
				Item.find({adon: 'Y', type:'land'}).limit(10).then((land)=>{
					Item.find({adon: 'Y', sell:'sell',price_sell:{$lte:30000}}).limit(10).then((affordable)=>{
						Item.find({adon: 'Y', type: {$in: ['consumer']}}).limit(5).then((commercial)=>{
							Item.find({adon: 'Y', sell:{$in:['rent','jeon']}}).limit(5).then((rent)=>{
								res.render('home', {gallery: gallery, recommended: recommended, luxury:luxury,land:land,affordable:affordable,commercial:commercial,rent:rent});
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

					}else{
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
								regexBuilder = regexBuilder.concat(sh.recommended[i]+'|');
							}
							regexBuilder = regexBuilder.concat('[^철근콘크리트|일반목구조|조적조|경량철골조]');
							//console.log(regexBuilder);
							findQuery.detail_structure = new RegExp(regexBuilder);
						}else{
							findQuery.detail_structure.$in = sh.recommended;
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
							regexBuilder = regexBuilder.concat('[^강하면|강상면|양평읍|옥천면|양서면|서종면|용문면|지평면|개군면|청운면|단월면|양동면|퇴촌면|남종면]');
							findQuery.address_up = new RegExp(regexBuilder);
						}else{
							findQuery.address_up = {};
							findQuery.address_up.$nin = ['강하면','강상면','양평읍','옥천면','양서면','서종면','용문면','지평면','개군면','청운면','단월면','양동면','퇴촌면','남종면'];
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
		if(skipQuery===0) res.render('list',{data:data, listType: listType});
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
				res.render('item',{data:data[0], similar: similar, user:user[0]});
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
						expiresIn: "30m"
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
				if (sh.address_up) findQuery.address_up = sh.address_up;
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
				if (sh.area_recommended) findQuery.area_recommended = sh.area_recommended;
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
			Item.find(findQuery).or([sharedItem,{share:'N',user:userQuery}]).sort(sort).skip(30 * pages).limit(30).then((data) => {
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
	
				Item.find(findQuery).or([sharedItem,{share:'N',user:userQuery}]).then((result) => {
					if (uuid === undefined) uuid = "";
					res.cookie('excel',excel_uuid);
					res.render("manage", { uuid: uuid, data: data, count: result.length, current: pages });
				})
	
				Item.find(findQuery).or([sharedItem,{share:'N',user:userQuery}]).sort(sort).skip(30 * pages).limit(100).then((data2) => {
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

app.get('/lab',(req,res)=>{
	res.render('lab');
});

app.post('/lab', upload.array('images'), (req,res)=>{
	console.log('/lab POST');
	console.log(req.body);
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

app.post("/register", upload.array('image', 100), (req, res) => {
	if(!fs.existsSync('./public/images/thumbnail')){
		fs.mkdirSync('./public/images/thumbnail');
	}
	if (jwtverify(req.cookies)) {
		console.log(req.files);
		let filenames = [];
		if(typeof req.files === 'undefined') req.files=[];
		for (let i = 0; i < req.files.length; i++) {
			if (req.files[i] !== undefined) filenames.push('/'+req.files[i].filename);
		}
		req.body.id = req.body.id_letter + req.body.id_number;
		req.body.timestamp = new Date().getTime();
		req.body.gallery = he.encode(req.body.gallery);
		req.body.detail = he.encode(req.body.detail);
		req.body.thumbnail = filenames.length===0? '' : '/thumbnail'+ filenames[0];
		logger.info('added item ' + req.body.id);
		mongooseIO.postItem(req.body, filenames);
		setTimeout(()=>{
			res.redirect("/manage");
		},500);		
		setTimeout(()=>{
			if(req.body.thumbnail.length!=0){
				if(fs.existsSync('./public/images/thumbnailtemp')) fs.unlinkSync('./public/images/thumbnailtemp');
				fs.copyFile('./public/images'+filenames[0],'./public/images/thumbnailtemp',(e)=>{
					sharp('./public/images'+filenames[0]).resize({fit:'fill',width:233,height:165})
					.toFile('./public/images/thumbnail'+filenames[0],(err,info)=>{
						if(err){
							fs.unlink('./public/images'+filenames[0],(b)=>{
								fs.rename('./public/images/thumbnailtemp','./public/images'+filenames[0],(a)=>{
									if(fs.existsSync('./public/images/thumbnail'+filenames[0])){
										fs.unlink('./public/images/thumbnail'+filenames[0],(d)=>{
											fs.copyFile('./public/images'+filenames[0],'./public/images/thumbnail'+filenames[0],(z)=>{});
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
		},5000);
		setTimeout(()=>{
			let loopArray = function(x){
				if(x===filenames.length){
					return;
				}else{
					if(fs.existsSync('./public/images/temp')){
						fs.unlinkSync('./public/images/temp');
					}
					fs.copyFile('./public/images'+filenames[x],'./public/images/temp',()=>{
						fs.rename('./public/images'+filenames[x],'./public/images'+filenames[x]+'2',(err)=>{
							sharp('./public/images'+filenames[x]+'2').resize({fit:'fill',width:950,height:550})
							.toFile('./public/images'+filenames[x],(err,info)=>{
								if(err){
									logger.info(err);
									if(fs.existsSync('./public/images'+filenames[x])) fs.unlinkSync('./public/images'+filenames[x]);
									fs.unlinkSync('./public/images'+filenames[x]+'2');
									fs.rename('./public/images/temp','./public/images'+filenames[x],()=>{loopArray(x+1)});
								}else{
									fs.unlinkSync('./public/images'+filenames[x]+'2');
									fs.unlink('./public/images/temp',()=>{loopArray(x+1)});
								}
							})
						})						
					})
				}
			}
			loopArray(0);
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

app.get("/details", (req, res) => {
	if (jwtverify(req.cookies)) {
		Item.find({ _id: req.query.id }).then((data) => {
			data[0].detail = he.decode(data[0].detail);
			data[0].gallery = he.decode(data[0].gallery);
			User.find().then((info)=>{
				res.render('details', { data: JSON.stringify(data), user: info });
			})
		})
	} else {
		logger.info('unauthorized access to /details GET');
		res.render('unauthorized');
	}
})


app.post("/details", upload.array('image', 100), (req, res) => {
	if(!fs.existsSync('./public/images/thumbnail')){
		fs.mkdirSync('./public/images/thumbnail');
	}
	if (jwtverify(req.cookies)) {
		Item.find({_id:req.body.query_id}).then((data)=>{
			let imageArray = req.body.imageArray.split(',');
			let currentItem = req.body.query_id;
			delete req.body.imageArray;		
			delete req.body.query_id;
			let imageref = [];
			let count = 0;
			for(let i = 0 ; i < imageArray.length ; i++){
				if(imageArray[i]!==''){
					if(imageArray[i]==='updated'){
						imageref.push('/'+req.files[count].filename);
						count++;
					}else{
						imageref.push(imageArray[i]);
					}
				}
			}
			let deleteFile = '';
			try{
				if(data[0].image[0]!=imageref[0]){
					deleteFile = data[0].image[0];
					fs.unlink('./public/images/thumbnail'+deleteFile,(err)=>{
						if(err) logger.info(err);
					})
				}
			}catch{
	
			}
	
			req.body.timestamp_modified = new Date().getTime();
			req.body.gallery = he.encode(req.body.gallery);
			req.body.detail = he.encode(req.body.detail);
			if(data[0].image[0]!=imageref[0]) req.body.thumbnail = '/thumbnail' + imageref[0];
			req.body.image = imageref;
			req.body.id = req.body.id_letter + req.body.id_number;
	
			Item.updateOne({ _id: currentItem }, req.body)
				.then(() => { 
					logger.info('updated ' + req.body.id);
				})
				.catch((err) => { logger.info(err); });
	
			res.redirect('/manage');
			setTimeout(()=>{
				if(deleteFile.length!=0){
					sharp('./public/images'+imageref[0])
					.resize(233,165).toFile('./public/images/thumbnail'+imageref[0],(err, info)=>{logger.info(err);});
				}
			},5000);
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
	res.render('about');
});

app.get("/location",(req,res)=>{
	res.render('location');
});

app.get("/tos",(req,res)=>{
	res.render('tos');
});

app.get("/privacy",(req,res)=>{
	res.render('privacy');
});

app.get("/responsibility",(req,res)=>{
	res.render('responsibility');
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
	if(req.body.password==='3756'){
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

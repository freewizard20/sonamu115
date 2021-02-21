const bcrypt = require("bcryptjs");

function hash(password){
	bcrypt.hash(10, function(err,salt){
		brcypt.hash(password,salt,function(err,hash){
			return hash;
		});
	});
}

function findContract(given){
	let matrix = [['on','진행'],['pending','보류'],['complete','완료']];
	for(let i = 0 ; i < 3 ; i++){
		if(given===matrix[i][0]) return matrix[i][1];
	}
}

function findSell(given){
	let matrix = [['sell','매매'],['jeon','전세'],['rent','월세']];
	for(let i = 0 ; i < 3 ; i++){
		if(given===matrix[i][0]) return matrix[i][1];
	}
}

function findType(given){
	let matrix = [['house','전원주택/별장'],['consumer','상가/음식점/모텔'],['land','토지/농막'],['rent','전월세'],['villa','아파트/빌라'],['factory','창고/공장']];
	for(m of matrix){
		if(given===m[0]) return m[1];
	}
}

function findAd(given){
	let result = [];
	let matrix = [['gallery','갤러리'],['recommended','추천'],['urgent','급'],['premium','프'],['new','신규'],['theme','테마'],['land','토지']];
	for(g of given){
		for(m of matrix){
			if(g===m[0]) result.push(m[1]);
		}
	}
	return result;
}

function timestampToDate(given){
    return new Date(given).toISOString().split('T')[0];
}

module.exports = {
	findAd,
	findType,
	findContract,
	findSell,
	timestampToDate,
}
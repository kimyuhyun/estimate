var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var db = require('../db');
var moment = require('moment');

/*
    :ID
    req.params

    get:
    req.query

    post:
    req.body
*/


router.get('/estimate/:IDX', async function(req, res, next) {
    var idx = req.params.IDX;
    var sql = "";
    var row = new Object();
    var list = new Object();

    var docNum = "";
    var sourceId = "";
    var destIdx = "";


    //기본정보 세팅
    sql = "SELECT * FROM ESTIMATE_tbl WHERE IDX = ?";
    await new Promise(function(resolve, reject) {
        db.query(sql, idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0])
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        destIdx = data.DSTORE_IDX;
        sourceId = data.MEMB_ID;

        row.edate = moment(data.EDATE).format('YYYY년 MM월 DD일');
        row.destName = data.DSTORE_COMPNAY;
        row.destMemo = data.MEMO;
    });

    if (destIdx != '') {
        sql = "SELECT TEL, FAX, HP, EMAIL FROM DSTORE_tbl WHERE IDX = ?";
        await new Promise(function(resolve, reject) {
            db.query(sql, destIdx, function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0])
                } else {
                    res.send(err);
                }
            });
        }).then(function(data) {
            row.destTel = data.TEL;
            row.destFax = data.FAX;
            row.destHp = data.HP;
            row.destEmail = data.EMAIL;
        });
    }

    //문서번호 생성하기
    sql = "SELECT IDX FROM ESTIMATE_tbl WHERE MEMB_ID = ?";
    await new Promise(function(resolve, reject) {
        db.query(sql, sourceId, function(err, rows, fields) {
            if (!err) {
                for (i = 0; i < rows.length; i++) {
                    if (rows[i].IDX == idx) {
                        resolve(i+1);
                        break;
                    }
                }
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        if (data < 10) {
            docNum = "000" + data;
        } else if (data < 100) {
            docNum = "00" + data;
        } else if (data < 1000) {
            docNum = "0" + data;
        }
        row.docNum = moment().format('YYYYMMDD') + "-" + docNum;
    });
    //


    sql = "SELECT * FROM MEMB_tbl WHERE ID = ?";
    await new Promise(function(resolve, reject) {
        db.query(sql, sourceId, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0])
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        delete data.WDATE;
        delete data.LDATE;
        delete data.PASS1;
        delete data.IDX;
        delete data.ID;
        row = Object.assign(row, data);
    });

    //총금액 구하기
    sql = "SELECT SUM(DANGA * QTY) as TTL FROM ESTIMATE_CHILD_tbl WHERE PARENT_IDX = ?";
    await new Promise(function(resolve, reject) {
        db.query(sql, idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0].TTL);
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        row.TTL_PRICE = data;
        row.HAN_PRICE = geKoreanNumber(data);
    });

    //상품리스트 구하기
    sql = `SELECT NAME1, GUKUK, MEMO, UNIT, QTY, DANGA, FILENAME0, PRICE, TAX FROM ESTIMATE_CHILD_tbl WHERE PARENT_IDX = ?`;
    await new Promise(function(resolve, reject) {
        db.query(sql, idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        list = data;
    });

    console.log(list);

    res.render('./doc/estimate1.html', {
        row: row,
        list: list,
    });
});




function geKoreanNumber(number) {
    const koreanNumber = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    const tenThousandUnit = ['', '만', '억', '조'];
    const tenUnit = ['', '십', '백', '천'];
    let answer = '';
    let unit = 10000;
    let index = 0;
    let division = Math.pow(unit, index);

    while (Math.floor(number / division) > 0) {
        const mod = Math.floor(number % (division * unit) / division);
        if (mod) {
            const modToArray = mod.toString().split('');
            const modLength = modToArray.length - 1;
            const toKorean = modToArray.reduce((a, v, i) => {
                a += `${koreanNumber[v*1]}${tenUnit[modLength - i]}`;
                return a;
            }, '');
            answer = `${toKorean}${tenThousandUnit[index]} ` + answer;
        }
        division = Math.pow(unit, ++index);
    }
    return answer;
}


module.exports = router;

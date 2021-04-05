var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');
var db = require('../db');
var utils = require('../Utils');


async function checkMiddleWare(req, res, next) {
    var rows;
    await new Promise(function(resolve, reject) {
        var sql = `SELECT VISIT FROM ANALYZER_tbl WHERE IP = ? ORDER BY IDX DESC LIMIT 0, 1`;
        db.query(sql, req.sessionID, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            }
        });
    }).then(function(data){
        rows = data;
    });

    await new Promise(function(resolve, reject) {
        var sql = `INSERT INTO ANALYZER_tbl SET IP = ?, AGENT = ?, VISIT = ?, WDATE = NOW()`;
        if (rows.length > 0) {
            var cnt = rows[0].VISIT + 1;
            db.query(sql, [req.sessionID, req.headers['user-agent'], cnt], function(err, rows, fields) {
                resolve(cnt);
            });
        } else {
            db.query(sql, [req.sessionID, req.headers['user-agent'], 1], function(err, rows, fields) {
                resolve(1);
            });
        }
    }).then(function(data) {
        console.log(data);
    });

    //현재 접속자 파일 생성
    var memo = new Date().getTime() + "|S|" + req.baseUrl + req.path;
    fs.writeFile('./liveuser/'+req.sessionID, memo, function(err) {
        console.log(memo);
    });
    //
    next();

}

router.get('/', checkMiddleWare, function(req, res, next) {
    // var sql = ``;
    // db.query(sql, function(err, rows, fields) {
    //     console.log(rows);
    //     if (!err) {
    //
    //     } else {
    //         res.send(err);
    //     }
    // });

    res.send('');
});



module.exports = router;

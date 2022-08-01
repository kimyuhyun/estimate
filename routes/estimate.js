var express = require("express");
var router = express.Router();
var bodyParser = require("body-parser");
var db = require("../db");
var moment = require("moment");
var utils = require("../Utils");

router.get("/:IDX", async function (req, res, next) {
    var template = req.query.template;
    var idx = req.params.IDX;
    var sql = "";
    var my = new Object();
    var your = new Object();
    var list = new Object();

    var docNum = "";
    var sourceId = "";
    var destIdx = "";

    //기본정보 세팅
    sql = "SELECT * FROM DOC_tbl WHERE IDX = ?";
    await new Promise(function (resolve, reject) {
        db.query(sql, idx, function (err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                resolve(err);
            }
        });
    }).then(function (data) {
        if (data == null) {
            res.send(data);
            return;
        }

        destIdx = data.DSTORE_IDX;
        sourceId = data.MEMB_ID;

        your = data;
        your.EN_EDATE = moment(data.EDATE).format("YYYY-MM-DD");
        your.EDATE = moment(data.EDATE).format("YYYY년 MM월 DD일");
    });

    console.log(your.EN_EDATE);

    //문서번호 생성하기
    sql = "SELECT IDX FROM DOC_tbl WHERE MEMB_ID = ?";
    await new Promise(function (resolve, reject) {
        db.query(sql, sourceId, function (err, rows, fields) {
            if (!err) {
                for (i = 0; i < rows.length; i++) {
                    if (rows[i].IDX == idx) {
                        resolve(i + 1);
                        break;
                    }
                }
            } else {
                res.send(err);
            }
        });
    }).then(function (data) {
        if (data < 10) {
            docNum = "000" + data;
        } else if (data < 100) {
            docNum = "00" + data;
        } else if (data < 1000) {
            docNum = "0" + data;
        }
        my.docNum = moment().format("YYYYMMDD") + "-" + docNum;
    });
    //

    //나의 정보 가져오기
    sql = "SELECT * FROM MEMB_tbl WHERE ID = ?";
    await new Promise(function (resolve, reject) {
        db.query(sql, sourceId, function (err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                res.send(err);
            }
        });
    }).then(function (data) {
        delete data.WDATE;
        delete data.LDATE;
        delete data.PASS1;
        delete data.IDX;
        delete data.ID;
        my = Object.assign(my, data);
    });

    //총금액 구하기
    sql = "SELECT SUM(PRICE + TAX) as TTL FROM DOC_CHILD_tbl WHERE DOC_TYPE = 'estimate' AND PARENT_IDX = ?";
    await new Promise(function (resolve, reject) {
        db.query(sql, idx, function (err, rows, fields) {
            if (!err) {
                resolve(rows[0].TTL);
            } else {
                res.send(err);
            }
        });
    }).then(function (data) {
        my.TTL_PRICE = data;
        my.HAN_PRICE = utils.num2han(data);
    });

    //상품리스트 구하기
    sql = "SELECT NAME1, GUKUK, MEMO, UNIT, QTY, DANGA, FILENAME0, PRICE, TAX FROM DOC_CHILD_tbl WHERE DOC_TYPE = 'estimate' AND PARENT_IDX = ? ORDER BY SORT1 ASC";
    await new Promise(function (resolve, reject) {
        db.query(sql, idx, function (err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                res.send(err);
            }
        });
    }).then(function (data) {
        list = data;
    });

    console.log(my);

    res.render("./doc/estimate" + template + ".html", {
        my: my,
        your: your,
        list: list,
    });

    console.log("랜더완료");
});

router.get("/test/:number", async function (req, res, next) {
    const number = req.params.number;

    res.send(utils.num2han(number));
});

module.exports = router;

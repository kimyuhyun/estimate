var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');
var db = require('../db');
var multer = require('multer');
var uniqid = require('uniqid');
var utils = require('../Utils');
var requestIp = require('request-ip');
var moment = require('moment');

var upload = multer({
    storage: multer.diskStorage({
        destination: function(req, file, cb) {
            var date = new Date();
            var month = eval(date.getMonth() + 1);
            if (eval(date.getMonth() + 1) < 10) {
                month = "0" + eval(date.getMonth() + 1);
            }
            var dir = 'data/' + date.getFullYear() + "" + month;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            cb(null, dir);
        },
        filename: function(req, file, cb) {
            var tmp = file.originalname.split('.');
            var mimeType = tmp[tmp.length - 1];
            if ('php|phtm|htm|cgi|pl|exe|jsp|asp|inc'.includes(mimeType)) {
                mimeType = mimeType + "x";
            }
            cb(null, uniqid(file.filename) + '.' + mimeType);
        }
    })
});

async function checkMiddleWare(req, res, next) {
    var ip = requestIp.getClientIp(req);

    var rows;
    await new Promise(function(resolve, reject) {
        var sql = `SELECT VISIT FROM ANALYZER_tbl WHERE IP = ? ORDER BY IDX DESC LIMIT 0, 1`;
        db.query(sql, ip, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            }
        });
    }).then(function(data) {
        rows = data;
    });

    await new Promise(function(resolve, reject) {
        var sql = `INSERT INTO ANALYZER_tbl SET IP = ?, AGENT = ?, VISIT = ?, WDATE = NOW()`;
        if (rows.length > 0) {
            var cnt = rows[0].VISIT + 1;
            // console.log(sql, [ip, req.headers['user-agent'], cnt]);
            db.query(sql, [ip, req.headers['user-agent'], cnt], function(err, rows, fields) {
                resolve(cnt);
            });
        } else {
            db.query(sql, [ip, req.headers['user-agent'], 1], function(err, rows, fields) {
                resolve(1);
            });
        }
    }).then(function(data) {
        console.log(data);
    });

    //현재 접속자 파일 생성
    var memo = new Date().getTime() + "|S|" + req.baseUrl + req.path;
    fs.writeFile('./liveuser/' + ip, memo, function(err) {
        console.log(memo);
    });
    //
    next();

}


router.get('/myinfo/:ID', checkMiddleWare, function(req, res, next) {
    var id = req.params.ID;
    var sql = `SELECT * FROM MEMB_tbl WHERE ID = ?`;
    db.query(sql, id, function(err, rows, fields) {
        // console.log(rows);
        if (!err) {
            res.send(rows[0]);
        } else {
            res.send(err);
        }
    });
});

router.post('/myinfo', checkMiddleWare, function(req, res, next) {
    var id = req.body.ID;

    delete req.body.ID;

    var sql = ""
    var records = new Array();

    for (key in req.body) {
        if (req.body[key] != 'null') {
            if (key == 'PASS1') {
                sql += key + '= PASSWORD(?), ';
            } else {
                sql += key + '= ?, ';
            }
            records.push(req.body[key]);
        }
    }
    records.push(id);
    sql = "UPDATE MEMB_tbl SET " + sql + " LDATE = NOW() WHERE ID = ?";
    db.query(sql, records, function(err, rows, fields) {
        console.log(rows);
        if (!err) {
            res.send(rows);
        } else {
            res.send(err);
        }
    });
});

router.get('/login/:ID', checkMiddleWare, async function(req, res, next) {
    var id = req.params.ID;
    var level1 = 9;
    var cnt = 0;

    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT, LEVEL1 FROM MEMB_tbl WHERE ID = ?`;
        db.query(sql, id, function(err, rows, fields) {
            cnt = rows[0].CNT;
            level1 = rows[0].LEVEL1;
            resolve(1);
        });
    }).then();


    if (cnt > 0) {
        var sql = `UPDATE MEMB_tbl SET LDATE = NOW() WHERE ID = ?`;
        db.query(sql, id);
    } else {
        //처음 가입자는 무조건 레벨 9
        await new Promise(function(resolve, reject) {
            var sql = `INSERT INTO MEMB_tbl SET ID = ?, LEVEL1 = 9, WDATE = NOW(), LDATE = NOW()`;
            db.query(sql, id, function(err, rows, fields) {
                if (!err) {
                    level1 = 9;
                    resolve(1);
                } else {
                    console.log(err);
                }
            });
        }).then();
    }
    req.session.ID = id;
    req.session.LEVEL1 = level1;

    req.session.save(function() {
        res.send({
            code: 1,
            ID: id,
            LEVEL1: level1,
        });
    });
});


//거래처
router.get('/dstore/:ID', checkMiddleWare, function(req, res, next) {
    var id = req.params.ID;
    var sql = "SELECT * FROM DSTORE_tbl WHERE MEMB_ID = ? ORDER BY IDX DESC";
    db.query(sql, id, function(err, rows, fields) {
        // console.log(rows);
        if (!err) {
            res.send(rows);
        } else {
            res.send(err);
        }
    });
});

//상품리스트
router.get('/product/:ID', checkMiddleWare, function(req, res, next) {
    var id = req.params.ID;
    var sql = "SELECT IDX, NAME1, GUKUK, COST_PRICE, SALE_PRICE, FILENAME0, IS_TAX_FREE, UNIT, MEMO FROM PDT_tbl WHERE MEMB_ID = ? ORDER BY IDX DESC";
    db.query(sql, id, function(err, rows, fields) {
        if (!err) {
            res.send(rows);
        } else {
            res.send(err);
        }
    });
});

//견적서 리스트
router.get('/estimate/:ID', checkMiddleWare, function(req, res, next) {
    var id = req.params.ID;
    var sql = `SELECT
                A.IDX,
                A.EDATE,
                A.COMPANY,
                A.MEMO,
                (SELECT SUM(DANGA * QTY) FROM DOC_CHILD_tbl WHERE DOC_TYPE = 'estimate' AND PARENT_IDX = A.IDX) as TTL_PRICE
                FROM DOC_tbl as A
                WHERE A.MEMB_ID = ? AND DOC_TYPE = 'estimate' ORDER BY A.EDATE DESC`;
    db.query(sql, id, function(err, rows, fields) {
        if (!err) {
            res.send(rows);
        } else {
            res.send(err);
        }
    });
});



//발주서 리스트
router.get('/balju/:ID', checkMiddleWare, function(req, res, next) {
    var id = req.params.ID;
    var sql = `SELECT
                A.IDX,
                A.EDATE,
                A.COMPANY,
                A.MEMO,
                (SELECT SUM(DANGA * QTY) FROM DOC_CHILD_tbl WHERE DOC_TYPE = 'balju' AND PARENT_IDX = A.IDX) as TTL_PRICE
                FROM DOC_tbl as A
                WHERE A.MEMB_ID = ? AND DOC_TYPE = 'balju' ORDER BY A.EDATE DESC`;
    db.query(sql, id, function(err, rows, fields) {
        if (!err) {
            res.send(rows);
        } else {
            res.send(err);
        }
    });
});

//명세서 리스트
router.get('/mungse/:ID', checkMiddleWare, function(req, res, next) {
    var id = req.params.ID;
    var sql = `SELECT
                A.IDX,
                A.EDATE,
                A.COMPANY,
                A.MEMO,
                (SELECT SUM(DANGA * QTY) FROM DOC_CHILD_tbl WHERE DOC_TYPE = 'mungse' AND PARENT_IDX = A.IDX) as TTL_PRICE
                FROM DOC_tbl as A
                WHERE A.MEMB_ID = ? AND DOC_TYPE = 'mungse' ORDER BY A.EDATE DESC`;
    db.query(sql, id, function(err, rows, fields) {
        if (!err) {
            res.send(rows);
        } else {
            res.send(err);
        }
    });
});


//문서번호 및 회사명 가져오기
router.get('/get_doc_num/:ID/:IDX', async function(req, res, next) {
    var id = req.params.ID;
    var idx = req.params.IDX;

    var companyName = "";

    await new Promise(function(resolve, reject) {
        var sql = "SELECT IDX, COMPANY FROM MEMB_tbl WHERE ID = ?";
        db.query(sql, id, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0].COMPANY);
            } else {
                res.send(err);
            }
        });
    }).then(function(data){
        companyName = data;
    });

    await new Promise(function(resolve, reject) {
        var sql = "SELECT IDX FROM DOC_tbl WHERE MEMB_ID = ?";
        db.query(sql, id, function(err, rows, fields) {
            if (!err) {
                var docNum = "";
                for (i = 0; i < rows.length; i++) {
                    if (rows[i].IDX == idx) {
                        if (i < 10) {
                            docNum = "000" + (i+1);
                        } else if (i < 100) {
                            docNum = "00" + (i+1);
                        } else if (i < 1000) {
                            docNum = "0" + (i+1);
                        }
                        docNum = moment().format('YYYYMMDD') + "-" + docNum;
                        resolve(docNum);
                        break;
                    }
                }
            } else {
                res.send(err);
            }
        });
    }).then(function(data){
        res.send({
            docNum: data,
            companyName: companyName,
        });
    });
});


router.get('/view/:TABLE/:ID/:IDX', checkMiddleWare, function(req, res, next) {
    var table = req.params.TABLE;
    var id = req.params.ID;
    var idx = req.params.IDX;

    var sql = "SELECT * FROM " + table + " WHERE MEMB_ID = ? AND IDX = ?";
console.log(sql);
    db.query(sql, [id, idx], function(err, rows, fields) {
        console.log(rows);
        if (!err) {
            res.send(rows[0]);
        } else {
            res.send(err);
        }
    });
});









router.post('/write', checkMiddleWare, function(req, res, next) {
    var idx = req.body.IDX;
    var table = req.body.TABLE;

    delete req.body.IDX;
    delete req.body.TABLE;

    console.log(req.body);

    var sql = ""
    var records = new Array();
    for (key in req.body) {
        if (req.body[key] != 'null') {
            if (key == 'PASS1') {
                sql += key + '= PASSWORD(?), ';
            } else {
                sql += key + '= ?, ';
            }
            records.push(req.body[key]);
        }
    }

    if (idx == null) {
        sql = "INSERT INTO " + table + " SET " + sql + " WDATE = NOW(), LDATE = NOW()";
        db.query(sql, records, function(err, rows, fields) {
            if (!err) {
                res.send({
                    code: 1,
                    msg: '등록 되었습니다.',
                    result: rows,
                });
            } else {
                res.send(err);
            }
        });
    } else {
        records.push(idx);
        sql = "UPDATE " + table + " SET " + sql + " LDATE = NOW() WHERE IDX = ?";
        db.query(sql, records, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                res.send({
                    code: 1,
                    msg: '수정 되었습니다.',
                    result: rows,
                });
            } else {
                res.send(err);
            }
        });
    }
});


router.post('/delete', checkMiddleWare, async function(req, res, next) {
    var idx = req.body.IDX;
    var id = req.body.ID;
    var table = req.body.TABLE;

    var sql = "DELETE FROM " + table + " WHERE IDX = ? AND MEMB_ID = ?";
    db.query(sql, [idx, id], function(err, rows, fields) {
        if (!err) {
            res.send({
                code: 1,
                msg: '삭제 되었습니다.'
            });
        } else {
            res.send(err);
        }
    });
});


router.get('/daum_address', function(req, res, next) {
    res.render('./daum_address');
});

router.post('/file_upload', upload.single('upload_file'), async function(req, res, next) {
    await utils.setResize(req.file).then(function(newFileName) {
        console.log('newFileName', newFileName);
        res.send(newFileName);
    });
});


router.get('/file_upload', function(req, res, next) {
    var html = `
        <div>`+process.env.HOST_NAME+`</div>
        <form method='post' action='./file_upload' enctype='multipart/form-data'>
            <input type='file' name='upload_file' />
            <input type='submit'>
        </form>
    `;

    res.send(html);
});


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

    res.render('./index.html', {
        asd: 'QWEQWE',
    });
});



module.exports = router;

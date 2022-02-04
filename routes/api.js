var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');
var db = require('../db');
var multer = require('multer');
var uniqid = require('uniqid');
var utils = require('../Utils');
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
    if (req.query.token == null || req.query.token != 'kkyyhh') {
        res.send('Not Bad 404');
        return;
    }

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

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

    fs.readdir('./liveuser', async function(err, filelist) {
        for (file of filelist) {
            await new Promise(function(resolve, reject) {
                fs.readFile('./liveuser/' + file, 'utf8', function(err, data) {
                    resolve(data);
                });
            }).then(function(data) {
                try {
                    if (file != 'dummy') {
                        var tmp = data.split('|S|');
                        console.log(data);
                        moment.tz.setDefault("Asia/Seoul");
                        var connTime = moment.unix(tmp[0] / 1000).format('YYYY-MM-DD HH:mm');
                        var minDiff = moment.duration(moment(new Date()).diff(moment(connTime))).asMinutes();
                        if (minDiff > 4) {
                            console.log(minDiff);
                            fs.unlink('./liveuser/' + file, function(err) {
                                console.log(err);
                            });
                        }
                    }
                } catch (e) {
                    console.log(e);
                }
            });
        }
    });

    //현재 접속자 파일 생성
    var memo = new Date().getTime() + "|S|" + req.baseUrl + req.path;
    fs.writeFile('./liveuser/' + ip, memo, function(err) {
        console.log(memo);
    });
    //
    next();

}

router.get('/is_memb/:ID', checkMiddleWare, function(req, res, next) {
    var id = req.params.ID;
    var sql = `SELECT CNUM FROM MEMB_tbl WHERE ID = ?`;
    db.query(sql, id, function(err, rows, fields) {
        console.log(rows);
        if (!err) {
            if (rows[0]) {
                res.send(rows[0]);
            } else {
                res.send({ CNUM: '' });
            }

        } else {
            res.send(err);
        }
    });
});


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
                (SELECT SUM(PRICE + TAX) FROM DOC_CHILD_tbl WHERE DOC_TYPE = 'estimate' AND PARENT_IDX = A.IDX) as TTL_PRICE
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
                (SELECT SUM(PRICE + TAX) FROM DOC_CHILD_tbl WHERE DOC_TYPE = 'balju' AND PARENT_IDX = A.IDX) as TTL_PRICE
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
                (SELECT SUM(PRICE + TAX) FROM DOC_CHILD_tbl WHERE DOC_TYPE = 'mungse' AND PARENT_IDX = A.IDX) as TTL_PRICE
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

//영수증 리스트
router.get('/youngsu/:ID', checkMiddleWare, function(req, res, next) {
    var id = req.params.ID;
    var sql = `SELECT
                A.IDX,
                A.EDATE,
                A.COMPANY,
                A.MEMO,
                (SELECT SUM(DANGA * QTY) FROM DOC_CHILD_tbl WHERE DOC_TYPE = 'youngsu' AND PARENT_IDX = A.IDX) as TTL_PRICE
                FROM DOC_tbl as A
                WHERE A.MEMB_ID = ? AND DOC_TYPE = 'youngsu' ORDER BY A.EDATE DESC`;
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
                if (rows.length > 0) {
                    resolve(rows[0].COMPANY);
                } else {
                    resolve('미등록');
                }
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



router.get('/doc_modify/:ID/:IDX', checkMiddleWare, async function(req, res, next) {
    var id = req.params.ID;
    var idx = req.params.IDX;

    var info = {};
    var list = {};

    await new Promise(function(resolve, reject) {
        var sql = "SELECT * FROM DOC_tbl WHERE MEMB_ID = ? AND IDX = ?";
        db.query(sql, [id, idx], function(err, rows, fields) {
            resolve(rows[0]);
        });
    }).then(function(data) {
        info = data;
    });

    await new Promise(function(resolve, reject) {
        var sql = "SELECT * FROM DOC_CHILD_tbl WHERE MEMB_ID = ? AND PARENT_IDX = ? ORDER BY SORT1";
        db.query(sql, [id, idx], function(err, rows, fields) {
            resolve(rows);
        });
    }).then(function(data) {
        list = data;
    });

    res.send({
        info: info,
        list: list,
    });
});


//자식 상품 삭제
router.get('/doc_child_delete/:ID/:PARENT_IDX', checkMiddleWare, async function(req, res, next) {
    var id = req.params.ID;
    var parentIdx = req.params.PARENT_IDX;

    var sql = "DELETE FROM DOC_CHILD_tbl WHERE MEMB_ID = ? AND PARENT_IDX = ?";
    db.query(sql, [id, parentIdx], function(err, rows, fields) {
        if (!err) {
            res.send({code: 1});
        } else {
            res.send({code: 0});
        }
    });
});


//구독정보저장!
router.get('/save_my_subscript/:id/:is_subscript', checkMiddleWare, function(req, res, next) {
    const { id, is_subscript } = req.params;
    var sql = `UPDATE MEMB_tbl SET IS_SUBSCRIPT = ? WHERE ID = ?`;
    db.query(sql, [is_subscript, id], function(err, rows, fields) {
        if (!err) {
            res.send(rows);
        } else {
            res.send(err);
        }
    });
});


//빠른견적 리스트
router.get('/quick/:ID', checkMiddleWare, function(req, res, next) {
    var id = req.params.ID;
    var sql = `SELECT IDX, EDATE, COMPANY, TTL_PRICE, IS_VAT FROM QUICK_tbl WHERE MEMB_ID = ? ORDER BY EDATE DESC`;
    db.query(sql, id, function(err, rows, fields) {
        if (!err) {
            res.send(utils.nvl(rows));
        } else {
            res.send(err);
        }
    });
});


//빠른견적 디테일
router.get('/quick/:ID/:IDX', checkMiddleWare, async function(req, res, next) {
    const id = req.params.ID;
    const idx = req.params.IDX;

    var obj = {};

    await new Promise(function(resolve, reject) {
        const sql = `SELECT EDATE, COMPANY, TTL_PRICE, CSV, IS_VAT FROM QUICK_tbl WHERE MEMB_ID = ? AND IDX = ?`;
        db.query(sql, [id, idx], function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
                res.send(err);
            }
        });
    }).then(function(data) {
        obj = data;
    });


    var csv = obj.CSV;
    delete obj.CSV;

    var tmpArr = csv.split(',');
    var tmpArr2 = tmpArr.division(4);

    var arr = [];
    for (rows of tmpArr2) {
        var o = {};
        o.col1 = rows[0];
        o.col2 = rows[1];
        o.col3 = rows[2];
        o.col4 = rows[3];
        arr.push(o);
    }

    obj.array = arr;

    res.send(utils.nvl(obj));

});

//배열을 인풋값에 맞게 나줘줌!!
Array.prototype.division = function (n) {
    var arr = this;
    var len = arr.length;
    var cnt = Math.floor(len / n) + (Math.floor(len % n) > 0 ? 1 : 0);
    var tmp = [];
    for (var i = 0; i < cnt; i++) {
        tmp.push(arr.splice(0, n));
    }
    return tmp;
}
//




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

router.post('/copy', checkMiddleWare, async function(req, res, next) {
    let idx = req.body.IDX;
    let table = req.body.TABLE;
    var arr = {};

    await new Promise(function(resolve, reject) {
        let sql = `SELECT * FROM ${table} WHERE idx = ?`;
        console.log(sql, idx);
        db.query(sql, idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        arr = utils.nvl(data);
    });

    delete arr.IDX;
    delete arr.WDATE;
    delete arr.LDATE;

    var sql = '';
    var records = new Array();
    for (key in arr) {
        if (arr[key] != 'null') {
            if (key == 'PASS1') {
                sql += key + '= PASSWORD(?), ';
            } else {
                sql += key + '= ?, ';
            }
            records.push(arr[key]);
        }
    }

    await new Promise(function(resolve, reject) {
        sql = `INSERT INTO ${table} SET ${sql} WDATE = NOW(), LDATE = NOW()`;
        db.query(sql, records, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        arr = utils.nvl(data);
    });
    res.send(arr);
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

router.post('/save_gukuk_unit', checkMiddleWare, async function(req, res, next) {
    const id = req.body.MEMB_ID;
    const gukuk = req.body.GUKUK;
    const unit = req.body.UNIT;

    var cnt = 0;
    var sql = '';

    if (gukuk) {
        sql = `SELECT COUNT(*) as cnt FROM GUKUK_tbl WHERE MEMB_ID = ? AND NAME1 = ?`;
        await new Promise(function(resolve, reject) {
            db.query(sql, [id, gukuk], function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0]);
                } else {
                    res.send(err);
                }
            });
        }).then(function(data) {
            cnt = data.cnt;
        });

        if (cnt == 0) {
            sql = `INSERT INTO GUKUK_tbl SET MEMB_ID = ?, NAME1 = ?`;
            db.query(sql, [id, gukuk]);
        }
    }

    if (unit) {
        sql = `SELECT COUNT(*) as cnt FROM UNIT_tbl WHERE MEMB_ID = ? AND NAME1 = ?`;
        await new Promise(function(resolve, reject) {
            db.query(sql, [id, unit], function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0]);
                } else {
                    res.send(err);
                }
            });
        }).then(function(data) {
            cnt = data.cnt;
        });

        if (cnt == 0) {
            sql = `INSERT INTO UNIT_tbl SET MEMB_ID = ?, NAME1 = ?`;
            db.query(sql, [id, unit]);
        }
    }


});

router.get('/get_gukuk/:MEMB_ID', checkMiddleWare, async function(req, res, next) {
    const id = req.params.MEMB_ID;
    var arr = [];

    const sql = `SELECT IDX, NAME1 FROM GUKUK_tbl WHERE MEMB_ID = ?`;
    await new Promise(function(resolve, reject) {
        db.query(sql, id, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        arr = data;
    });
    res.send(arr);
});

router.get('/get_unit/:MEMB_ID', checkMiddleWare, async function(req, res, next) {
    const id = req.params.MEMB_ID;
    var arr = [];

    const sql = `SELECT IDX, NAME1 FROM UNIT_tbl WHERE MEMB_ID = ?`;
    await new Promise(function(resolve, reject) {
        db.query(sql, id, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        arr = data;
    });
    res.send(arr);
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
        asd: '견적서드림 API서버',
    });
});



module.exports = router;

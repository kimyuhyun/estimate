var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs')
var uniqid = require('uniqid');
var db = require('../db');
var utils = require('../Utils');



function userChecking(req, res, next) {
    //여기서 토큰 체크!
    if (req.session.ID == null) {
        res.redirect('/admin/login');
        return;
    }
    //
    next();
}


router.post('/list', userChecking, async function(req, res, next) {
    var table = req.query.table;
    var board_id = req.query.board_id;
    var level1 = req.query.level1;
    var step = req.query.step;
    var parent_idx = req.query.parent_idx;
    var params;

    if (req.body.request != null) {
        params = JSON.parse(req.body.request);
    } else {
        params.offset = 0;
        params.limit = 10;
    }

    // console.log(params);

    var records = 0;
    var sql = "";
    var where = " WHERE 1=1 ";
    var orderby = "";
    var start = params.offset == null ? 0 : params.offset;
    var rows = params.limit;

    if (board_id != null) {
        where += " AND board_id = '" + board_id + "'";
    }

    if (step != null) {
        where += " AND step = '" + step + "'";
    }

    if (parent_idx != null) {
        where += " AND parent_idx = '" + parent_idx + "'";
    }

    if (level1 != null) {
        where += " AND level1 = " + level1;
    }

    if (params.search != null) {
        var tmp = "";
        for (var i in params.search) {
            if (i > 0) {
                tmp += " OR ";
            }
            tmp += params.search[i].field + " LIKE '%" + params.search[i].value + "%'";
        }
        where += " AND (" + tmp + ")";
    }


    var sql = "SELECT COUNT(*) as CNT FROM " + table + where;
    await db.query(sql, function(err, rows, fields) {
        records = rows[0].CNT;
    });


    if (params.sort != null) {
        orderby = ` ORDER BY `;
        var tmp = '';
        for (obj of params.sort) {
            tmp += `, ${obj.field} ${obj.direction} `;
        }
        orderby += tmp.substring(1);
    } else {
        orderby = " ORDER BY idx DESC ";
    }

    sql = "SELECT * FROM " + table + where + orderby + " LIMIT " + start + ", " + rows;
    console.log(sql);
    await db.query(sql, function(err, rows, fields) {
        var arr = new Object();
        arr['status'] = 'success';
        arr['total'] = records;
        arr['records'] = rows;
        res.send(arr);
    });
});

router.get('/iterator', userChecking, async function(req, res, next) {
    var table = req.query.table;
    var sql = "SELECT * FROM " + table + " ORDER BY idx DESC";
    db.query(sql, table, function(err, rows, fields) {
        res.send(rows);
    });
});

router.post('/write', userChecking, async function(req, res, next) {
    console.log(req.body);
    var table = req.body.table;
    var idx = req.body.idx;

    delete req.body.recid;
    delete req.body.table;
    delete req.body.idx;
    delete req.body.created;
    delete req.body.modified;

    var sql = ""
    var records = new Array();

    for (key in req.body) {
        if (req.body[key] != 'null') {
            if (key == 'pass1') {
                sql += key + '= PASSWORD(?), ';
            } else {
                sql += key + '= ?, ';
            }

            records.push(req.body[key]);
        }
    }

    // console.log(records);return;

    if (idx == null) {
        sql = "INSERT INTO " + table + " SET " + sql + " created = NOW(), modified = NOW()";
        await db.query(sql, records, function(err, rows, fields) {
            if (!err) {
                var arr = new Object();
                arr['code'] = 1;
                arr['msg'] = '등록 되었습니다.';
                res.send(arr);
            } else {
                res.send(err);
            }
        });
    } else {
        records.push(idx);
        sql = "UPDATE " + table + " SET " + sql + " modified = NOW() WHERE idx = ?";
        await db.query(sql, records, function(err, rows, fields) {
            if (!err) {
                db.query("SELECT * FROM " + table + " WHERE idx = ?", idx, function(err, rows, fields) {
                    var arr = new Object();
                    arr['code'] = 2;
                    arr['msg'] = '수정 되었습니다.';
                    arr['record'] = rows[0];
                    res.send(arr);
                });
            } else {
                res.send(err);
            }
        });
    }
    // console.log(sql, records);
});

router.get('/view', userChecking, async function(req, res, next) {
    console.log('/view', req.body);

    var arr = new Object();
    arr['status'] = 'success';
    res.send(arr);
});

router.post('/delete', userChecking, async function(req, res, next) {
    const table = req.body.table;
    const idx = req.body.idx;
    const sql = "DELETE FROM " + table + " WHERE idx = ?";
    db.query(sql, idx);

    res.send({
        code: 1,
        msg: '삭제 되었습니다.'
     });
});

router.post('/remove', userChecking, async function(req, res, next) {
    var table = req.query.table;
    var params = JSON.parse(req.body.request);
    console.log(params);
    var sql = ``;
    for (idx of params.selected) {
        sql = `DELETE FROM ${table} WHERE idx = ${idx}`;
        db.query(sql);
        console.log(sql);
    }
    var arr = new Object();
    arr['code'] = 1;
    res.send(arr);
});

router.post('/reply_delete', userChecking, async function(req, res, next) {
    var table = req.query.table;
    var params = JSON.parse(req.body.request);
    console.log(params);
    var sql = ``;
    for (idx of params.selected) {
        sql = `UPDATE ${table} SET id='admin', name1='관리자', memo='삭제된 댓글 입니다.', filename0='' WHERE idx = ${idx}`;
        db.query(sql);
    }
    var arr = new Object();
    arr['code'] = 1;
    res.send(arr);
});

router.post('/copy', userChecking, async function(req, res, next) {
    const table = req.query.table;
    var sql = '';
    var arr = [];

    if (!Array.isArray(req.body.idx)) {
        arr.push(req.body.idx);
    } else {
        arr = req.body.idx;
    }

    for (idx of arr) {
        await new Promise(function(resolve, reject) {
            sql = 'SELECT * FROM ' + table + ' WHERE idx = ?';
            db.query(sql, idx, function(err, rows, fields) {
                if (!err) {
                    delete rows[0].idx;
                    delete rows[0].modified;
                    delete rows[0].created;

                    let records = [];
                    sql = 'INSERT INTO ' + table + ' SET ';
                    for (key in rows[0]) {
                        if (rows[0][key] != 'null') {
                            if (key == 'pass1') {
                                sql += key + '=PASSWORD(?),';
                            } else {
                                sql += key + '=?,';
                            }
                            records.push(rows[0][key]);
                        }
                    }
                    sql += 'created=NOW(),modified=NOW()';

                    db.query(sql, records, function(err, rows, fields) {
                        if (!err) {
                            resolve();
                        } else {
                            console.log(err);
                        }
                    });
                } else {
                    console.log(err);
                }
            });
        }).then();
    }

    res.send({
        code: 1,
    });
});


router.post('/file_delete', userChecking, async function(req, res, next) {
    console.log(req.body.filename);
    await fs.exists(req.body.filename, function(exists) {
        console.log(exists);
        var arr = new Object();
        if (exists) {
            fs.unlink(req.body.filename, function(err) {
                if (!err) {
                    arr['code'] = 1;
                    res.send(arr);
                }
            });
        } else {
            arr['code'] = 0;
            res.send(arr);
        }
    });
});


module.exports = router;

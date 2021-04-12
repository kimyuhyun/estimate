var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var db = require('../db');
var menus = require('../menu');
var utils = require('../Utils');

//메뉴를 전역변수에 넣어준다!
global.MENUS = menus;
global.SAVE_MENUS;
global.CURRENT_URL;
//


/*
    :ID
    req.params

    get:
    req.query

    post:
    req.body
*/

function checkMiddleWare(req, res, next) {
    if (process.env.NODE_ENV != 'development') {
        if (req.session.ID == null) {
            res.redirect('/admin/login');
            return;
        }
    }

    CURRENT_URL = req.baseUrl + req.path;

    utils.setSaveMenu(req).then(function(data) {
        SAVE_MENUS = data;
        next();
    });
}

router.get('/graph1', checkMiddleWare, async function(req, res, next) {
    var sql = ``;
    await new Promise(function(resolve, reject) {
        db.query(sql, function(err, rows, fields) {
            console.log(rows);
            if (!err) {

            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        rows = data;
    });
});



module.exports = router;

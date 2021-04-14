var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var db = require('../db');
var menus = require('../menu');
var utils = require('../Utils');
var bcrypt = require('bcrypt');
var multiparty = require('multiparty');
var xlsx = require('xlsx');

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

router.get('/get_excel_token/:ID', async function(req, res, next) {
    var id = req.params.ID;
    var cnt = 0;

    await new Promise(function(resolve, reject) {
        var sql = "SELECT COUNT(*) as CNT, TOKEN FROM EXCEL_TOKEN_tbl WHERE MEMB_ID = ?";
        db.query(sql, id, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        cnt = data.CNT;
        token = data.TOKEN;
    });

    if (cnt == 0) {
        var token = "";
        await new Promise(function(resolve, reject) {
            bcrypt.hash(id, 10, function(err, encrypted) {
                if (err) {
                    resolve(err);
                } else {
                    resolve(encrypted);
                }
            });
        }).then(function(data) {
            token = data;
        });

        token = replaceAll(token, "/", "");
        token = replaceAll(token, ".", "");
        token = replaceAll(token, "$", "");

        sql = "INSERT INTO EXCEL_TOKEN_tbl SET MEMB_ID = ?, TOKEN = ?, WDATE = NOW(), LDATE = NOW()";
        db.query(sql, [id, token]);
    }

    res.send({
        EXCEL_TOKEN: token,
    });
});

router.get('/pdt_upload', function(req, res, next) {
    res.send('잘못된 접속입니다.');
});

router.get('/ds_upload', function(req, res, next) {
    res.send('잘못된 접속입니다.');
});

router.get('/pdt_upload/:TOKEN', function(req, res, next) {
    var token = req.params.TOKEN;
    res.render('./pdt_excel_upload', {
        token: token,
    });
});

router.get('/ds_upload/:TOKEN', function(req, res, next) {
    var token = req.params.TOKEN;
    res.render('./ds_excel_upload', {
        token: token,
    });
});


//상품업로드
router.post('/pdt_upload', function(req, res, next) {
    var token = req.query.TOKEN;
    let result = {};
    const form = new multiparty.Form({
        autoFiles: true, //POST 방식으로 전달된 파일만 처리
    });

    form.on('file', async (name, file) => { //파일이 입력 되었을 때 발생하는 이벤트
        const workbook = xlsx.readFile(file.path); //xlsx 파일 가져와서 객체 생성
        const sheetnames = Object.keys(workbook.Sheets); //엑셀 sheets 이름 가져오기
        let i = sheetnames.length; //전체 엑셀 시트 개수
        while (i--) { // sheet 수 만큼 while문 반복
            const sheetname = sheetnames[i]; //한개의 sheet
            // result = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetname]).split('\n');
            // result.shift(); //첫번째 array 데이터 삭제
            // result.pop(); //마지막 array 데이터 삭제
            result = xlsx.utils.sheet_to_json(workbook.Sheets[sheetname]);

        }

        console.log(result.length);

        if (result.length == 0) {
            res.render('./pdt_excel_upload_completed',{
                msg: '업로드된 상품이 없습니다.',
                token: token,
            });
            return;
        }


        //아이디 구하기
        var id = "";
        await new Promise(function(resolve, reject) {
            var sql = "SELECT MEMB_ID FROM EXCEL_TOKEN_tbl WHERE TOKEN = ?";
            db.query(sql, token, function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0].MEMB_ID);
                } else {
                    res.send(err);
                }
            });
        }).then(function(data) {
            id = data;
        });

        //기존상품 다 지우기
        await new Promise(function(resolve, reject) {
            db.query("DELETE FROM PDT_tbl WHERE MEMB_ID = ?", id, function(err, rows, fields) {
                resolve(rows);
            });
        }).then(function(data) {
            // console.log(data);
        });
        //

        //상품 넣기!!
        for (obj of result) {
            await new Promise(function(resolve, reject) {
                var gukuk = obj['규격']==null?'':obj['규격'];
                var unit = obj['단위']==null?'':obj['단위'];
                var costPrice = obj['원가']==null?'0':obj['원가'];
                var isTaxFree = obj['면세여부']=='Y'?'1':'0';
                var memo = obj['메모']==null?'':obj['메모'];

                var sql = `INSERT INTO PDT_tbl SET
                            MEMB_ID = ?,
                            NAME1 = ?,
                            GUKUK = ?,
                            UNIT = ?,
                            COST_PRICE = ?,
                            SALE_PRICE = ?,
                            IS_TAX_FREE = ?,
                            MEMO = ?,
                            WDATE = NOW(),
                            LDATE = NOW() `;
                db.query(sql, [id, obj['품명'], gukuk, unit, costPrice, obj['판매가'], isTaxFree, memo], function(err, rows, fields) {
                    if (!err) {
                        // resolve(rows[0].MEMB_ID);
                        resolve(1);
                    } else {
                        console.log('Err', err);
                        res.render('./pdt_excel_upload_completed',{
                            msg: 'Excel 파일을 예제상품의 형식에 맞게 업로드 해주세요.',
                            token: token,
                        });
                        return;
                    }
                });
            }).then(function(data) {

            });
        }

        res.render('./pdt_excel_upload_completed',{
            msg: '정상적으로 업로드가 완료 되었습니다. 앱에서 확인해주세요.',
            token: token,
        });
    });

    //form 데이타를 업로드 하는 중간중간에 현재 진행 상태를 출력하기 위한 이벤트
    // form.on('progress', function(byteRead, byteExpected) {
    //     console.log('Reading total: ' + byteRead + '/' + byteExpected);
    //     // res.write('Reading total: ' + byteRead + '/' + byteExpected + '\n');
    // });
    // form 데이터 업로드가 끝났을 때 발생하는 이벤트
    // form.on('close', () => {
    //     res.end('It\'s saved!');
    // });

    form.parse(req);    //임마는 필수다!!
});

//거래처업로드
router.post('/ds_upload', function(req, res, next) {
    var token = req.query.TOKEN;
    let result = {};
    const form = new multiparty.Form({
        autoFiles: true, //POST 방식으로 전달된 파일만 처리
    });

    form.on('file', async (name, file) => { //파일이 입력 되었을 때 발생하는 이벤트
        const workbook = xlsx.readFile(file.path); //xlsx 파일 가져와서 객체 생성
        const sheetnames = Object.keys(workbook.Sheets); //엑셀 sheets 이름 가져오기
        let i = sheetnames.length; //전체 엑셀 시트 개수
        while (i--) { // sheet 수 만큼 while문 반복
            const sheetname = sheetnames[i]; //한개의 sheet
            // result = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetname]).split('\n');
            // result.shift(); //첫번째 array 데이터 삭제
            // result.pop(); //마지막 array 데이터 삭제
            result = xlsx.utils.sheet_to_json(workbook.Sheets[sheetname]);

        }

        console.log(result.length);

        if (result.length == 0) {
            res.render('./ds_excel_upload_completed',{
                msg: '업로드된 거래처가 없습니다.',
                token: token,
            });
            return;
        }


        //아이디 구하기
        var id = "";
        await new Promise(function(resolve, reject) {
            var sql = "SELECT MEMB_ID FROM EXCEL_TOKEN_tbl WHERE TOKEN = ?";
            db.query(sql, token, function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0].MEMB_ID);
                } else {
                    res.send(err);
                }
            });
        }).then(function(data) {
            id = data;
        });

        //기존거래처 다 지우기
        await new Promise(function(resolve, reject) {
            db.query("DELETE FROM DSTORE_tbl WHERE MEMB_ID = ?", id, function(err, rows, fields) {
                resolve(rows);
            });
        }).then(function(data) {
            // console.log(data);
        });
        //

        //거래처 넣기!!
        for (obj of result) {
            await new Promise(function(resolve, reject) {
                var cnum = obj['사업자번호']==null?'':obj['사업자번호'];
                var name1 = obj['대표자']==null?'':obj['대표자'];
                var uptae = obj['업태']==null?'':obj['업태'];
                var jongmok = obj['종목']==null?'':obj['종목'];
                var tel = obj['전화']==null?'':obj['전화'];
                var fax = obj['팩스']==null?'':obj['팩스'];
                var hp = obj['핸드폰']==null?'':obj['핸드폰'];
                var email = obj['이메일']==null?'':obj['이메일'];
                var zipcode = obj['우편번호']==null?'':obj['우편번호'];
                var addr1 = obj['주소']==null?'':obj['주소'];
                var addr2 = obj['상세주소']==null?'':obj['상세주소'];
                var memo = obj['메모']==null?'':obj['메모'];

                var sql = `INSERT INTO DSTORE_tbl SET
                            MEMB_ID = ?,
                            COMPANY = ?,
                            CNUM = ?,
                            NAME1 = ?,
                            UPTAE = ?,
                            JONGMOK = ?,
                            TEL = ?,
                            FAX = ?,
                            HP = ?,
                            EMAIL = ?,
                            ZIPCODE = ?,
                            ADDR1 = ?,
                            ADDR2 = ?,
                            MEMO = ?,
                            WDATE = NOW(),
                            LDATE = NOW() `;
                db.query(sql, [id, obj['회사명'], cnum, name1, uptae, jongmok, tel, fax, hp, email, zipcode, addr1, addr2, memo], function(err, rows, fields) {
                    if (!err) {
                        // resolve(rows[0].MEMB_ID);
                        resolve(1);
                    } else {
                        console.log('Err', err);
                        res.render('./ds_excel_upload_completed',{
                            msg: 'Excel 파일을 예제상품의 형식에 맞게 업로드 해주세요.',
                            token: token,
                        });
                        return;
                    }
                });
            }).then(function(data) {

            });
        }

        res.render('./ds_excel_upload_completed',{
            msg: '정상적으로 업로드가 완료 되었습니다. 앱에서 확인해주세요.',
            token: token,
        });
    });

    //form 데이타를 업로드 하는 중간중간에 현재 진행 상태를 출력하기 위한 이벤트
    // form.on('progress', function(byteRead, byteExpected) {
    //     console.log('Reading total: ' + byteRead + '/' + byteExpected);
    //     // res.write('Reading total: ' + byteRead + '/' + byteExpected + '\n');
    // });
    // form 데이터 업로드가 끝났을 때 발생하는 이벤트
    // form.on('close', () => {
    //     res.end('It\'s saved!');
    // });

    form.parse(req);    //임마는 필수다!!
});

function replaceAll(str, searchStr, replaceStr) {
    return str.split(searchStr).join(replaceStr);
}

module.exports = router;

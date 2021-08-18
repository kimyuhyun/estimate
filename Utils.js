const sharp = require('sharp');
const fs = require('fs');
var db = require('./db');
var requestIp = require('request-ip');

class Utils {
    setSaveMenu(req) {
        var self = this;
        return new Promise(function(resolve, reject) {
            if (req.query.NAME1 != null) {
                db.query('SELECT * FROM SAVE_MENU_tbl WHERE LINK = ? AND ID = ?', [CURRENT_URL, req.session.ID], function(err, rows, fields) {
                    if (!err) {
                        if (rows.length == 0) {
                            var sql = `
                                INSERT INTO SAVE_MENU_tbl SET
                                ID = ?,
                                NAME1 = ?,
                                LINK = ? `;
                            console.log(sql, [req.session.ID, req.query.NAME1, CURRENT_URL]);
                            db.query(sql, [req.session.ID, req.query.NAME1, CURRENT_URL], function(err, rows, fields) {
                                self.getSaveMenu(req).then(function(data) {
                                    resolve(data);
                                });
                            });
                        } else {
                            self.getSaveMenu(req).then(function(data) {
                                resolve(data);
                            });
                        }
                    } else {
                        console.log('err', err);
                        res.send(err);
                    }
                });
            } else {
                self.getSaveMenu(req).then(function(data) {
                    resolve(data);
                });
            }
        });
    }

    getSaveMenu(req) {
        return new Promise(function(resolve, reject) {
            console.log(req.session);
            if (req.session.ID != null) {
                db.query("SELECT * FROM SAVE_MENU_tbl WHERE ID = ?", req.session.ID, function(err, rows, fields) {
                    if (!err) {
                        resolve(rows);
                    } else {
                        console.log('err', err);
                        res.send(err);
                    }
                });
            } else {
                resolve(0);
            }
        });
    }

    setResize(file) {
        var self = this;
        return new Promise(function(resolve, reject) {
            // console.log(file);
            var destWidth = 300;
            var tmp = file.originalname.split('.');
            var mimeType = tmp[tmp.length - 1];
            tmp = file.filename.split('.');
            var filename = tmp[0];
            var resizeFile = file.destination + '/' + filename + '_resize.' + mimeType;

            if ('jpg|jpeg|png|gif'.includes(mimeType)) {
                var img = new sharp(file.path);
                img.metadata().then(function(meta) {
                    if (meta.width <= destWidth) {
                        resolve(file.path);
                    } else {
                        var rs = self.execResize(file, destWidth, resizeFile);
                        resolve(rs);
                    }
                });
            } else {
                resolve(file.path);
            }
        });
    }

    execResize(file, destWidth, resizeFile) {
        try {
            sharp(file.path)
                .resize({
                    width: destWidth
                })
                .withMetadata()
                .toFile(resizeFile, function(err, info) {
                    if (!err) {
                        // console.log('info', info);
                        //원본파일 삭제!!
                        fs.unlink(file.path, function(err) {
                            if (err) {
                                throw err
                            }
                        });
                        //
                    } else {
                        throw err
                    }
                });
        } catch (e) {
            console.log('ImageResize Error', e);
        } finally {
            return resizeFile;
        }
    }

    getWidth(file) {
        return new Promise(function(resolve, reject) {
            var img = new sharp(file.path);
            img.metadata().then(function(meta) {
                resolve(meta.width);
            });
        });
    }

    num2han(num) {
        num = parseInt((num + '').replace(/[^0-9]/g, ''), 10) + ''; // 숫자/문자/돈 을 숫자만 있는 문자열로 변환
        if (num == '0') {
            return '영';
        }
        var number = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
        var unit = ['', '만', '억', '조'];
        var smallUnit = ['천', '백', '십', ''];
        var result = []; //변환된 값을 저장할 배열
        var unitCnt = Math.ceil(num.length / 4); //단위 갯수. 숫자 10000은 일단위와 만단위 2개이다.
        num = num.padStart(unitCnt * 4, '0') //4자리 값이 되도록 0을 채운다
        var regexp = /[\w\W]{4}/g; //4자리 단위로 숫자 분리
        var array = num.match(regexp);
        //낮은 자릿수에서 높은 자릿수 순으로 값을 만든다(그래야 자릿수 계산이 편하다)
        for (var i = array.length - 1, unitCnt = 0; i >= 0; i--, unitCnt++) {
            var hanValue = _makeHan(array[i]); //한글로 변환된 숫자
            if (hanValue == '') { //값이 없을땐 해당 단위의 값이 모두 0이란 뜻.
                continue;
            }
            result.unshift(hanValue + unit[unitCnt]); //unshift는 항상 배열의 앞에 넣는다.
        }
        //여기로 들어오는 값은 무조건 네자리이다. 1234 -> 일천이백삼십사
        function _makeHan(text) {
            var str = '';
            for (var i = 0; i < text.length; i++) {
                var num = text[i];
                if (num == '0') //0은 읽지 않는다
                    continue;
                str += number[num] + smallUnit[i];
            }
            return str;
        }
        return result.join('');
    }

    //null 값은 빈값으로 처리해준다!!
    nvl(arr) {
        if (arr.length != null) {
            for (var rows of arr) {
                for (var i in rows) {
                    if (rows[i] == null) {
                        rows[i] = '';
                    }
                }
            }
        } else {
            for (var i in arr) {
                if (arr[i] == null) {
                    arr[i] = '';
                }
            }
        }
        return arr;
    }
}

module.exports = new Utils();

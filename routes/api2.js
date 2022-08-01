var express = require("express");
var router = express.Router();
var moment = require("moment");
var utils = require("../Utils");

async function checkMiddleWare(req, res, next) {
    if (req.query.token == null || req.query.token != "kkyyhh") {
        res.send("Not Bad 404");
        return;
    }
    next();
}

router.get("/document_list/:page/:id/:doc_type", checkMiddleWare, async function (req, res, next) {
    var page = req.params.page;
    const id = req.params.id;
    const doc_type = req.params.doc_type;

    if (!page) {
        page = 1;
    }
    page = (page - 1) * 50;

    var sql = `
        SELECT
        A.IDX,
        A.EDATE,
        A.COMPANY,
        A.MEMO,
        (SELECT SUM(PRICE + TAX) FROM DOC_CHILD_tbl WHERE DOC_TYPE = ? AND PARENT_IDX = A.IDX) as TTL_PRICE
        FROM DOC_tbl as A
        WHERE A.MEMB_ID = ? 
        AND DOC_TYPE = ? 
        ORDER BY A.EDATE DESC
        LIMIT ?, 50 
    `;

    var arr = await utils.queryResult(sql, [doc_type, id, doc_type, page]);
    res.send(arr);
});

router.post("/set_text_history", checkMiddleWare, async function (req, res, next) {
    const id = req.body.MEMB_ID;
    const content = req.body.CONTENT;
    const refer = req.body.REFER;
    const ava = req.body.AVA;
    const dlv = req.body.DLV;
    const etc = req.body.ETC;

    if (content) {
        var sql = `SELECT COUNT(*) as CNT FROM TEXT_HISTORY_tbl WHERE MEMB_ID = ? AND FLAG = 'CONTENT' AND NAME1 = ? `;
        var arr = await utils.queryResult(sql, [id, content]);
        var obj = arr[0];
        if (obj.CNT == 0) {
            sql = `INSERT INTO TEXT_HISTORY_tbl SET MEMB_ID = ?, FLAG = 'CONTENT', NAME1 = ?`;
            arr = await utils.queryResult(sql, [id, content]);
        }
    }

    if (refer) {
        var sql = `SELECT COUNT(*) as CNT FROM TEXT_HISTORY_tbl WHERE MEMB_ID = ? AND FLAG = 'REFER' AND NAME1 = ? `;
        var arr = await utils.queryResult(sql, [id, refer]);
        var obj = arr[0];
        if (obj.CNT == 0) {
            sql = `INSERT INTO TEXT_HISTORY_tbl SET MEMB_ID = ?, FLAG = 'REFER', NAME1 = ?`;
            arr = await utils.queryResult(sql, [id, refer]);
        }
    }

    if (ava) {
        var sql = `SELECT COUNT(*) as CNT FROM TEXT_HISTORY_tbl WHERE MEMB_ID = ? AND FLAG = 'AVA' AND NAME1 = ? `;
        var arr = await utils.queryResult(sql, [id, ava]);
        var obj = arr[0];
        if (obj.CNT == 0) {
            sql = `INSERT INTO TEXT_HISTORY_tbl SET MEMB_ID = ?, FLAG = 'AVA', NAME1 = ?`;
            arr = await utils.queryResult(sql, [id, ava]);
        }
    }

    if (dlv) {
        var sql = `SELECT COUNT(*) as CNT FROM TEXT_HISTORY_tbl WHERE MEMB_ID = ? AND FLAG = 'DLV' AND NAME1 = ? `;
        var arr = await utils.queryResult(sql, [id, dlv]);
        var obj = arr[0];
        if (obj.CNT == 0) {
            sql = `INSERT INTO TEXT_HISTORY_tbl SET MEMB_ID = ?, FLAG = 'DLV', NAME1 = ?`;
            arr = await utils.queryResult(sql, [id, dlv]);
        }
    }

    if (etc) {
        var sql = `SELECT COUNT(*) as CNT FROM TEXT_HISTORY_tbl WHERE MEMB_ID = ? AND FLAG = 'ETC' AND NAME1 = ? `;
        var arr = await utils.queryResult(sql, [id, etc]);
        var obj = arr[0];
        if (obj.CNT == 0) {
            sql = `INSERT INTO TEXT_HISTORY_tbl SET MEMB_ID = ?, FLAG = 'ETC', NAME1 = ?`;
            arr = await utils.queryResult(sql, [id, etc]);
        }
    }
});

router.get("/get_text_history/:MEMB_ID/:FLAG", checkMiddleWare, async function (req, res, next) {
    const id = req.params.MEMB_ID;
    const flag = req.params.FLAG;
    var arr = [];
    const sql = `SELECT IDX, NAME1 FROM TEXT_HISTORY_tbl WHERE MEMB_ID = ? AND FLAG = ?`;
    var arr = await utils.queryResult(sql, [id, flag]);
    res.send(arr);
});

module.exports = router;

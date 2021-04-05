require('dotenv').config();
var maria = require('mysql');

var option;
if (process.env.NODE_ENV == 'development') {
    option = {
        host: process.env.DEV_DB_HOST,
        post: process.env.DEV_SERVER_PORT,
        user: process.env.DEV_DB_USER,
        password: process.env.DEV_DB_PASSWORD,
        database: process.env.DEV_DB_DATABASE
    };
} else {
    option = {
        host: process.env.DB_HOST,
        post: process.env.SERVER_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE
    };
}

var conn = maria.createConnection(option);


module.exports = conn;
module.exports.connAccount = option;

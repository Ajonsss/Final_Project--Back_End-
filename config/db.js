const mysql = require('mysql');
require('dotenv').config(); // Load environment variables

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if(err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to Database');
    }
});

module.exports = db;
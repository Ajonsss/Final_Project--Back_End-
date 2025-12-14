const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken'); 
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());


app.use('/images', express.static(path.join(__dirname, 'public/images')));


const authRoutes = require('./routes/authRoutes');
const memberRoutes = require('./routes/memberRoutes');
const financialRoutes = require('./routes/financialRoutes');

const financialController = require('./controllers/financialController'); 

const verifyUser = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.json({ Error: "You are not authenticated" });
    
    jwt.verify(token, "your_jwt_secret", (err, decoded) => {
        if (err) return res.json({ Error: "Token is not valid" });
        req.user = decoded;
        next();
    });
};

app.use('/', authRoutes);
app.use('/', memberRoutes);
app.use('/', financialRoutes);


app.delete('/delete-active-loan/:loanId', verifyUser, financialController.deleteActiveLoan);

app.post('/send-sms', verifyUser, financialController.sendSmsNotification);

const PORT = 8081;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
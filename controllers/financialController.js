const Financial = require('../models/financialModel');
const Notification = require('../models/notificationModel');
const User = require('../models/userModel');
const axios = require('axios'); // Required for iProgSMS
require('dotenv').config();

// --- HELPER: Calculate Next Date based on Day Name ---
function getNextDayOfWeek(startDate, dayName) {
    const dayMap = {
        "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
        "Thursday": 4, "Friday": 5, "Saturday": 6
    };

    const resultDate = new Date(startDate.getTime());
    resultDate.setHours(0, 0, 0, 0);

    const targetDay = dayMap[dayName];
    const currentDay = resultDate.getDay();

    // Calculate days to add. If today is the target day, we schedule for next week (7 days later)
    let distance = (targetDay + 7 - currentDay) % 7;
    if (distance === 0) distance = 7;

    resultDate.setDate(resultDate.getDate() + distance);
    return resultDate;
}

// --- NEW: SMS NOTIFICATION ---
exports.sendSmsNotification = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });

    const { phone_number, message } = req.body;

    // Use axios to send a POST request with Query Parameters matches your URL structure
    // Endpoint: https://www.iprogsms.com/api/v1/sms_messages
    axios.post('https://www.iprogsms.com/api/v1/sms_messages', null, {
        params: {
            // FIXED: Removed quotes so it reads the variable from .env
            api_token: process.env.IPROGSMS_API_KEY, 
            message: message,
            phone_number: phone_number
        }
    })
    .then(response => {
        // Log the response for debugging
        console.log("SMS Response:", response.data);

        // Check for success (Adjust based on actual API response, usually 200 OK is enough)
        if (response.status === 200 || response.data.success) {
            return res.json({ Status: "Success", Details: response.data });
        } else {
            return res.json({ Error: "SMS Provider Error", Details: response.data });
        }
    })
    .catch(err => {
        console.error("SMS Error Details:", err.response ? err.response.data : err.message);
        return res.json({ Error: "Failed to connect to SMS Gateway" });
    });
};
www.iprogsms.com

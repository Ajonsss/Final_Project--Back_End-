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
    // --- LOANS ---
exports.assignLoan = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });

    const { user_id, amount, loan_name, weeks, payment_day, weekly_amount } = req.body;

    Financial.findActiveLoan(user_id, (err, result) => {
        if (result.length > 0) return res.json({ Error: "Member already has an active loan." });

        const loanData = {
            user_id,
            amount,
            loan_name: loan_name || 'Personal Loan',
            weeks_to_pay: weeks,
            payment_day: payment_day,
            weekly_amount: weekly_amount
        };

        Financial.createLoan(loanData, (err, loanResult) => {
            if (err) return res.json({ Error: "Database Error" });

            const newLoanId = loanResult.insertId;

            // --- AUTOMATIC SCHEDULE GENERATION ---
            let currentDateTracker = new Date();

            for (let i = 0; i < weeks; i++) {
                currentDateTracker = getNextDayOfWeek(currentDateTracker, payment_day);

                const recordData = {
                    user_id: user_id,
                    type: 'loan_payment',
                    amount: weekly_amount,
                    due_date: currentDateTracker.toISOString().split('T')[0],
                    loan_id: newLoanId,
                    status: 'pending'
                };

                Financial.createRecord(recordData, () => { });
            }

            // Notifications
            User.findById(user_id, (err, userRes) => {
                const memberName = userRes[0]?.full_name || "Member";
                const memberMsg = `New Loan: ${loanData.loan_name} - ₱${amount}. Payable in ${weeks} weeks (₱${weekly_amount}/week).`;
                const adminMsg = `You assigned Loan (${loanData.loan_name}) to ${memberName}`;

                Notification.create(user_id, memberMsg, () => { });
                Notification.create(req.user.id, adminMsg, () => { });

                return res.json({ Status: "Success" });
            });
        });
    });
};

// --- DELETE LOAN ---
exports.deleteActiveLoan = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    const loanId = req.params.loanId;

    Financial.deleteLoan(loanId, (err) => {
        if (err) return res.json({ Error: "Error deleting loan" });
        return res.json({ Status: "Success" });
    });
};
// --- RECORDS ---
exports.assignRecord = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    const { user_id, type, amount, due_date, loan_id } = req.body;

    const data = { user_id, type, amount, due_date, loan_id: loan_id || null };
    Financial.createRecord(data, (err) => {
        if (err) return res.json({ Error: "Database Error" });

        
        User.findById(user_id, (err, userRes) => {
            
            const memberName = userRes[0]?.full_name || "Member";
            let typeText = type === 'loan_payment' ? 'Loan Payment' : (type === 'savings' ? 'Savings' : 'Insurance');
            const memberMsg = `Reminder: ${typeText} of ₱${amount} is due on ${due_date}`;
            const adminMsg = `You assigned a ${typeText} (₱${amount}) to ${memberName}`;

            Notification.create(user_id, memberMsg, () => { });

            Notification.create(req.user.id, adminMsg, () => { });

            res.json({ Status: "Success" });
        });
    });
};

exports.markPaid = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });

    Financial.findById(req.params.id, (err, result) => {
        if (err || result.length === 0) return res.json({ Error: "Record not found" });
        const record = result[0];

        if (['paid', 'late', 'cashed_out'].includes(record.status)) return res.json({ Error: "Already paid" });

        const today = new Date();
        const due = new Date(record.due_date);
        today.setHours(0, 0, 0, 0); due.setHours(0, 0, 0, 0);
        const newStatus = today > due ? 'late' : 'paid';

        Financial.updateStatus(req.params.id, newStatus, (err) => {
            if (err) return res.json({ Error: "Error updating record" });

            if (record.type === 'loan_payment' && record.loan_id) {
                Financial.updateLoanBalance(record.loan_id, record.amount, '-', (err) => {
                    Financial.closeLoan(record.loan_id, () => { });
                    return res.json({ Status: "Success" });
                });
            } else {
                return res.json({ Status: "Success" });
            }
        });
    });
};
exports.resetStatus = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });

    Financial.findById(req.params.id, (err, result) => {
        if (err || result.length === 0) return res.json({ Error: "Record not found" });
        const record = result[0];

        if (record.type === 'loan_payment' && record.loan_id && ['paid', 'late'].includes(record.status)) {
            Financial.updateLoanBalance(record.loan_id, record.amount, '+', () => {
                Financial.reactivateLoan(record.loan_id, () => {
                    Financial.updateStatus(req.params.id, 'pending', () => res.json({ Status: "Success" }));
                });
            });
        } else {
            Financial.updateStatus(req.params.id, 'pending', () => res.json({ Status: "Success" }));
        }
    });
};
};


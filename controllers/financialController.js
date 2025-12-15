const Financial = require('../models/financialModel');
const Notification = require('../models/notificationModel');
const User = require('../models/userModel');
const axios = require('axios');
require('dotenv').config();


function getNextDayOfWeek(startDate, dayName) {
    const dayMap = {
        "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
        "Thursday": 4, "Friday": 5, "Saturday": 6
    };

    const resultDate = new Date(startDate.getTime());
    resultDate.setHours(0, 0, 0, 0);

    const targetDay = dayMap[dayName];
    const currentDay = resultDate.getDay();


    let distance = (targetDay + 7 - currentDay) % 7;
    if (distance === 0) distance = 7;

    resultDate.setDate(resultDate.getDate() + distance);
    return resultDate;
}


exports.sendSmsNotification = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });

    const { phone_number, message } = req.body;


    axios.post('https://www.iprogsms.com/api/v1/sms_messages', null, {
        params: {

            api_token: process.env.IPROGSMS_API_KEY,
            message: message,
            phone_number: phone_number
        }
    })
        .then(response => {

            console.log("SMS Response:", response.data);


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
}

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

// --- RESET STATUS ---
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


exports.sendAutomatedDueReminders = async () => {
    console.log('Starting automated due reminders...');

    try {
        const sql = `
            SELECT fr.*, u.full_name, u.phone_number 
            FROM financial_records fr
            JOIN users u ON fr.user_id = u.id
            WHERE fr.status IN ('pending', 'late')
            AND fr.due_date <= DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            AND fr.due_date >= CURDATE()
            ORDER BY fr.due_date ASC
        `;



        const [records] = await db.query(sql);

        if (!records || records.length === 0) {
            console.log('No pending records due soon.');
            return;
        }

        let sentCount = 0;

        for (const record of records) {
            const { full_name, phone_number, type, amount, due_date } = record;

            const typeText = type === 'loan_payment' ? 'Loan Payment' :
                type.charAt(0).toUpperCase() + type.slice(1);

            const dueDate = new Date(due_date).toLocaleDateString();
            const message = `Hi ${full_name}, your ${typeText} of ₱${amount} is due on ${dueDate}. Please settle promptly.`;

            const result = await sendSms(phone_number, message);

            if (result.success) {
                sentCount++;
                console.log(`Reminder sent to ${full_name} (${phone_number})`);
            } else {
                console.error(`Failed to send reminder to ${full_name}: ${result.error}`);
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`Automated reminders completed. Sent ${sentCount} of ${records.length} reminders.`);

    } catch (error) {
        console.error('Error in automated reminders:', error);
    }
};

exports.getMemberDetails = (req, res) => {
    const userId = req.params.id;
    if (req.user.role !== 'leader' && req.user.id != userId) return res.json({ Error: "Access Denied" });

    User.findById(userId, (err, userRes) => {
        if (err || userRes.length === 0) return res.json({ Error: "User not found" });
        const user = userRes[0];

        if (user.role === 'leader') {
            delete user.profile_picture; delete user.birthdate; delete user.spouse_name;
        }

        Financial.findActiveLoan(userId, (err, loanRes) => {
            Financial.getRecordsByUser(userId, (err, recordRes) => {
                Notification.getByUser(userId, (err, notifRes) => {
                    Financial.getTotals(userId, (err, totals) => {
                        return res.json({
                            user,
                            activeLoan: loanRes[0] || null,
                            records: recordRes,
                            notifications: notifRes,
                            savingsTotal: totals.savings,
                            insuranceTotal: totals.insurance
                        });
                    });
                });
            });
        });
    });
};
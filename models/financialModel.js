const db = require('../config/db');

const Financial = {
    // --- LOANS ---
    findActiveLoan: (userId, callback) => {
        db.query("SELECT * FROM loans WHERE user_id = ? AND status = 'active'", [userId], callback);
    },
    
    // UPDATED: Now saves Weeks, Day, and Weekly Amount
    createLoan: (data, callback) => {
        const sql = "INSERT INTO loans (user_id, total_amount, current_balance, status, loan_name, weeks_to_pay, payment_day, weekly_amount) VALUES (?, ?, ?, 'active', ?, ?, ?, ?)";
        db.query(sql, [
            data.user_id, 
            data.amount, 
            data.amount, 
            data.loan_name,
            data.weeks_to_pay, 
            data.payment_day, 
            data.weekly_amount
        ], callback);
    },

    updateLoanBalance: (loanId, amount, operation, callback) => {
        // operation: '-' for payment, '+' for undo/cancel
        const sql = `UPDATE loans SET current_balance = current_balance ${operation} ? WHERE id = ?`;
        db.query(sql, [amount, loanId], callback);
    },

    closeLoan: (loanId, callback) => {
        db.query("UPDATE loans SET status = 'completed' WHERE id = ? AND current_balance <= 0", [loanId], callback);
    },

    reactivateLoan: (loanId, callback) => {
        db.query("UPDATE loans SET status = IF(current_balance > 0, 'active', 'completed') WHERE id = ?", [loanId], callback);
    },
}

module.exports = Financial;
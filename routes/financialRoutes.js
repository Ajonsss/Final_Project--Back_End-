const express = require('express');
const router = express.Router();
const financialController = require('../controllers/financialController');
const verifyToken = require('../middleware/authMiddleware');

// Loan management routes
router.post('/assign-loan', verifyToken, financialController.assignLoan);
//Record management routes
router.post('/assign-record', verifyToken, financialController.assignRecord);
router.get('/my-records/:id', verifyToken, financialController.getMyRecords);
//payment processing routes
router.put('/mark-paid/:id', verifyToken, financialController.markPaid);
router.put('/reset-status/:id', verifyToken, financialController.resetStatus);
router.delete('/delete-record/:id', verifyToken, financialController.deleteRecord);
router.put('/cash-out', verifyToken, financialController.cashOut);
// Member details Routes
router.get('/member-details/:id', verifyToken, financialController.getMemberDetails);
// Notification Routes
router.put('/mark-notification-read/:id', verifyToken, financialController.markNotificationRead);

module.exports = router;
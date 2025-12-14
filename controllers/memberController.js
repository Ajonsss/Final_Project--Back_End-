const bcrypt = require('bcrypt');
const User = require('../models/userModel');

// --- HELPER: Strong Password Validator ---
const isStrongPassword = (password) => {
    // Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
};

exports.addMember = async (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    
    // 1. Validate Password Strength
    if (!isStrongPassword(req.body.password)) {
        return res.json({ Error: "Password too weak. Must be 8+ chars, include uppercase, lowercase, number, and special char." });
    }

    const hash = await bcrypt.hash(req.body.password.toString(), 10);
    const data = {
        full_name: req.body.full_name,
        phone_number: req.body.phone_number,
        password: hash,
        birthdate: req.body.birthdate,
        spouse_name: req.body.spouse_name,
        image: req.file ? req.file.filename : null
    };

    User.create(data, (err) => {
        if (err) return res.json({ Error: "Error inserting data. Phone number might already exist." });
        return res.json({ Status: "Success" });
    });
};

exports.getProfile = (req, res) => {
    if (req.user.id != req.params.id && req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    
    User.findById(req.params.id, (err, result) => {
        if (err) return res.json({ Error: "Error fetching profile" });
        const user = result[0];
        if (user && user.role === 'leader') {
            delete user.profile_picture; delete user.birthdate; delete user.spouse_name;
        }
        return res.json({ Result: user });
    });
};
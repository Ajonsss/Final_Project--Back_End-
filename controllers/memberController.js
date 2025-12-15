const bcrypt = require('bcrypt');
const User = require('../models/userModel');

const isStrongPassword = (password) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
};

exports.addMember = async (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    
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


exports.getAllMembers = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    User.getAllMembers((err, result) => {
        if (err) return res.json({ Error: "Get users error" });
        return res.json({ Result: result });
    });
};

exports.deleteMember = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    User.delete(req.params.id, (err) => {
        if (err) return res.json({ Error: "Error deleting member" });
        return res.json({ Status: "Success" });
    });
};

exports.updateAdminPassword = async (req, res) => {
    if (!isStrongPassword(req.body.new_password)) {
        return res.json({ Error: "Weak Password. Use 8+ chars, Uppercase, Lowercase, Number, Special Char." });
    }

    const hash = await bcrypt.hash(req.body.new_password.toString(), 10);
    User.updatePassword(req.user.id, hash, (err) => {
        if (err) return res.json({ Error: "Error updating password" });
        return res.json({ Status: "Success" });
    });
};

exports.updateMemberDetails = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    User.updateDetails(req.params.id, req.body, (err) => {
        if (err) return res.json({ Error: "Error updating member" });
        return res.json({ Status: "Success" });
    });
};
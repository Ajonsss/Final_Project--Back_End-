 
 //day3c
 

 
 //day4b
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

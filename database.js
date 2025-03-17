const mysql = require('mysql2');

// Create a MySQL connection pool for remote database
const pool = mysql.createPool({
  host: '82.25.105.146', // Replace with your VPS IP (e.g., 193.203.184.158)
  user: 'terabox_user',
  password: 'Muiz123AHMED@',
  database: 'terabox_db'
});

// Default verify status
const defaultVerify = {
    is_verified: false,
    verified_time: 0,
    verify_token: "",
    premium: false,
    tokenused: false,
    link: ""
};

// Function to create a new user document template
function newUser(id) {
    return {
        _id: id,
        verify_status: { ...defaultVerify } // Use spread operator to avoid modifying defaultVerify
    };
}

// Check if a user is present in the database
async function presentUser(userId) {
    const [rows] = await pool.promise().query('SELECT 1 FROM users WHERE _id = ?', [userId]);
    return rows.length > 0;  // Return true if user is found
}

// Add a new user to the database
async function addUser(userId) {
    const user = newUser(userId);
    await pool.promise().query('INSERT INTO users (_id, verify_status) VALUES (?, ?)', [user._id, JSON.stringify(user.verify_status)]);
}

// Retrieve verify status for a user
async function dbVerifyStatus(userId) {
    const [rows] = await pool.promise().query('SELECT verify_status FROM users WHERE _id = ?', [userId]);
    if (rows.length > 0) {
        return JSON.parse(rows[0].verify_status); // Return parsed verify_status
    }
    return defaultVerify;
}

// Update verify status for a user
async function dbUpdateVerifyStatus(userId, verify) {
    await pool.promise().query('UPDATE users SET verify_status = ? WHERE _id = ?', [JSON.stringify(verify), userId]);
}

// Retrieve a list of all user IDs in the database
async function fullUserbase() {
    const [rows] = await pool.promise().query('SELECT _id FROM users');
    return rows.map(row => row._id); // Return array of user IDs
}

// Delete a user from the database
async function delUser(userId) {
    await pool.promise().query('DELETE FROM users WHERE _id = ?', [userId]);
}
async function getVerificationStatistics() {
    // Query to count total users
    const [totalUsersResult] = await pool.promise().query('SELECT COUNT(*) AS total_users FROM users');
    const totalUsers = totalUsersResult[0].total_users;

    // Query to count verified users
    const [verifiedUsersResult] = await pool.promise().query('SELECT COUNT(*) AS verified_users FROM users WHERE JSON_EXTRACT(verify_status, "$.is_verified") = true');
    const verifiedUsers = verifiedUsersResult[0].verified_users;

    // Query to count premium users
    const [premiumUsersResult] = await pool.promise().query('SELECT COUNT(*) AS premium_users FROM users WHERE JSON_EXTRACT(verify_status, "$.premium") = true');
    const premiumUsers = premiumUsersResult[0].premium_users;

    // Calculate unverified users
    const unverifiedUsers = totalUsers - verifiedUsers;

    // Create the status string
    const status = `
<b>📊 <u>Verification Statistics</u></b>\n
👥 <b>Total Users:</b> <code>${totalUsers}</code>
✅ <b>Verified Users:</b> <code>${verifiedUsers}</code>
💎 <b>Premium Users:</b> <code>${premiumUsers}</code>
❌ <b>Unverified Users:</b> <code>${unverifiedUsers}</code>`;

    return status;
}
// Function to add premium status to a user by user ID
async function addPremium(userId) {
    const verifyStatus = await dbVerifyStatus(userId); // Get the current verify status

    // Update the premium status to true
    verifyStatus.premium = true;

    // Update the verify status in the database
    await dbUpdateVerifyStatus(userId, verifyStatus);
}
async function rmpremium(userId) {
    const verifyStatus = await dbVerifyStatus(userId);
    verifyStatus.premium = false;
    await dbUpdateVerifyStatus(userId, verifyStatus);
}
async function closeConnection() {
    await pool.end();
}

module.exports = {
    presentUser,
    addUser,
    getVerificationStatistics,
    dbVerifyStatus,
    dbUpdateVerifyStatus,
    fullUserbase,
    delUser,
    rmpremium,
    closeConnection,
    addPremium
};

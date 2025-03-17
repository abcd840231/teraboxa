const mysql = require('mysql2');

const pool = mysql.createPool({
  host: '82.25.105.146',
  user: 'terabox_user',
  password: 'Muiz123AHMED@',
  database: 'terabox_db'
});

const defaultVerify = {
  is_verified: false,
  verified_time: 0,
  verify_token: "",
  premium: false,
  tokenused: false,
  link: ""
};

function newUser(id) {
  return {
    _id: id,
    verify_status: { ...defaultVerify }
  };
}

async function presentUser(userId) {
  const [rows] = await pool.promise().query('SELECT 1 FROM users WHERE _id = ?', [userId]);
  return rows.length > 0;
}

async function addUser(userId) {
  const user = newUser(userId);
  await pool.promise().query('INSERT INTO users (_id, verify_status) VALUES (?, ?)', [user._id, JSON.stringify(user.verify_status)]);
}

async function dbVerifyStatus(userId) {
  try {
    const [rows] = await pool.promise().query('SELECT verify_status FROM users WHERE _id = ?', [userId]);
    if (rows.length > 0) {
      const verifyStatus = rows[0].verify_status;
      try {
        return JSON.parse(verifyStatus);
      } catch (parseError) {
        console.error(`Invalid JSON in verify_status for user ${userId}: ${verifyStatus}`);
        return defaultVerify; // Fallback to default if JSON is invalid
      }
    }
    return defaultVerify;
  } catch (dbError) {
    console.error(`Database error in dbVerifyStatus for user ${userId}: ${dbError.message}`);
    return defaultVerify;
  }
}

async function dbUpdateVerifyStatus(userId, verify) {
  if (typeof verify !== 'object' || verify === null) {
    console.error(`Invalid verify object for user ${userId}: ${verify}`);
    return;
  }
  await pool.promise().query('UPDATE users SET verify_status = ? WHERE _id = ?', [JSON.stringify(verify), userId]);
}

async function fullUserbase() {
  const [rows] = await pool.promise().query('SELECT _id FROM users');
  return rows.map(row => row._id);
}

async function delUser(userId) {
  await pool.promise().query('DELETE FROM users WHERE _id = ?', [userId]);
}

async function getVerificationStatistics() {
  const [totalUsersResult] = await pool.promise().query('SELECT COUNT(*) AS total_users FROM users');
  const totalUsers = totalUsersResult[0].total_users;
  const [verifiedUsersResult] = await pool.promise().query('SELECT COUNT(*) AS verified_users FROM users WHERE JSON_EXTRACT(verify_status, "$.is_verified") = true');
  const verifiedUsers = verifiedUsersResult[0].verified_users;
  const [premiumUsersResult] = await pool.promise().query('SELECT COUNT(*) AS premium_users FROM users WHERE JSON_EXTRACT(verify_status, "$.premium") = true');
  const premiumUsers = premiumUsersResult[0].premium_users;
  const unverifiedUsers = totalUsers - verifiedUsers;

  const status = `
<b>📊 <u>Verification Statistics</u></b>\n
👥 <b>Total Users:</b> <code>${totalUsers}</code>
✅ <b>Verified Users:</b> <code>${verifiedUsers}</code>
💎 <b>Premium Users:</b> <code>${premiumUsers}</code>
❌ <b>Unverified Users:</b> <code>${unverifiedUsers}</code>`;
  return status;
}

async function addPremium(userId) {
  const verifyStatus = await dbVerifyStatus(userId);
  verifyStatus.premium = true;
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

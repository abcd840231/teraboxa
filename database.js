const { MongoClient } = require('mongodb');

// MongoDB connection setup
const uri = 'mongodb+srv://ani901696:6HkCOHW0lgarjDCI@cluster0.kv1dv.mongodb.net/?retryWrites=true&w=majority'; // Adjust this URI as needed
const client = new MongoClient(uri);
const dbName = 'teraboxaibot';
let db;

// Connect to MongoDB
async function connectDB() {
    if (!db) {
        await client.connect();
        db = client.db(dbName);
    }
    return db.collection('users');
}

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
    const collection = await connectDB();
    const user = await collection.findOne({ _id: userId });
    return !!user; // Return true if user is found
}

// Add a new user to the database
async function addUser(userId) {
    const collection = await connectDB();
    const user = newUser(userId);
    await collection.insertOne(user);
}

// Retrieve verify status for a user
async function dbVerifyStatus(userId) {
    const collection = await connectDB();
    const user = await collection.findOne({ _id: userId });
    return user ? user.verify_status : defaultVerify;
}

// Update verify status for a user
async function dbUpdateVerifyStatus(userId, verify) {
    const collection = await connectDB();
    await collection.updateOne(
        { _id: userId },
        { $set: { verify_status: verify } },
        { upsert: true }
    );
}

// Retrieve a list of all user IDs in the database
async function fullUserbase() {
    const collection = await connectDB();
    const users = await collection.find({}, { projection: { _id: 1 } }).toArray();
    return users.map(user => user._id);
}

// Delete a user from the database
async function delUser(userId) {
    const collection = await connectDB();
    await collection.deleteOne({ _id: userId });
}

// Get verification statistics
async function getVerificationStatistics() {
    const collection = await connectDB();
    
    const totalUsers = await collection.countDocuments();
    const verifiedUsers = await collection.countDocuments({ 'verify_status.is_verified': true });
    const premiumUsers = await collection.countDocuments({ 'verify_status.premium': true });
    const unverifiedUsers = totalUsers - verifiedUsers;

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
    const verifyStatus = await dbVerifyStatus(userId);
    verifyStatus.premium = true;
    await dbUpdateVerifyStatus(userId, verifyStatus);
}

// Remove premium status from a user
async function rmpremium(userId) {
    const verifyStatus = await dbVerifyStatus(userId);
    verifyStatus.premium = false;
    await dbUpdateVerifyStatus(userId, verifyStatus);
}

// Close MongoDB connection
async function closeConnection() {
    await client.close();
    db = null;
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
const express = require("express");
const axios = require("axios");
const {
  presentUser,
  addUser,
  dbVerifyStatus,
  dbUpdateVerifyStatus,
  getVerificationStatistics,
  addPremium,
  rmpremium
} = require("./database");
const app = express();
const crypto = require("crypto");
const time = () => Math.floor(Date.now() / 1000);
const TELEGRAM_TOKEN = "7737430767:AAEgE_xK5KrXgFvzg-N6mm48kgzWhZexfHo";
const VERIFY_EXPIRE = 43200;
const CHANNEL_ID = "teraboxai";
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const IS_VERIFY = true;
app.use(express.json());
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});
const sendMessage = async (
  chatId,
  text,
  replyMarkup = null,
  parse_mode = "Markdown"
) => {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: parse_mode, // Default parse mode
    };

    // Include reply markup if provided
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await axios.post(`${TELEGRAM_API_URL}/sendMessage`, payload);
    return res.data.result;
  } catch (error) {
    console.error("Error sending message:", error.response.data);
    return;
  }
};
const deleteMessage = async (chatId, messageId) => {
  try {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
    };

    const res = await axios.post(`${TELEGRAM_API_URL}/deleteMessage`, payload);

    // Return only the 'result' from the response data
    return res.data.result;
  } catch (error) {
    console.error("Error deleting message:", error);
    return;
  }
};
async function checkUserMembership(userId) {
  const url = `${TELEGRAM_API_URL}/getChatMember?chat_id=@${CHANNEL_ID}&user_id=${userId}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const status = data.result?.status;
    return (
      status === "member" || status === "administrator" || status === "creator"
    );
  } catch (error) {
    console.error("Error checking user membership:", error);
    return false;
  }
}
function getExpTime(seconds) {
  const periods = [
    ["days", 86400],
    ["hours", 3600],
    ["mins", 60],
    ["secs", 1],
  ];

  let result = "";
  for (const [periodName, periodSeconds] of periods) {
    if (seconds >= periodSeconds) {
      const periodValue = Math.floor(seconds / periodSeconds);
      seconds %= periodSeconds;
      result += `${periodValue}${periodName} `;
    }
  }
  return result;
}
async function addu(user_id) {
  const url = "https://api.teleservices.io/Broadcast/adduser/";
  const headers = {
    "Content-Type": "application/json",
  };
  const body = {
    access_token:
      "Teleservice_75901ff61ed5b82e56a472170413b4439178f8d1ffb7f09e173722d78ae5fd24",
    bot_token: TELEGRAM_TOKEN,
    user_id: user_id,
  };

  try {
    await axios.post(url, body, { headers });
  } catch (error) {
    console.error("An error occurred:", error);
  }
}
const retryWrapper = async (fn, maxRetries = 3) => {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempts++;
      console.warn(`Retrying (${attempts}/${maxRetries})...`);
      if (attempts === maxRetries) {
        console.error("Max retries reached:", error);
        throw error;
      }
    }
  }
};
function broadcast(cap, id) {
  axios.post("https://api.teleservices.io/Broadcast/broadcast/", {
    method: "sendMessage",
    text: cap,
    type: "text",
    access_token:
      "Teleservice_75901ff61ed5b82e56a472170413b4439178f8d1ffb7f09e173722d78ae5fd24",
    bot_token: TELEGRAM_TOKEN,
    admin: id,
  });
  return;
}
async function handleUpdate(update) {
  if (update.message) {
    const userId = update.message.from.id.toString(); // Ensure it's a string for comparison
    const chatId = update.message.chat.id;
    const userMention = `[${update.message.from.first_name || update.message.from.username}](tg://user?id=${userId})`;
    const text = update.message.text;
    if (text && text.startsWith("/start")) {
      const check = await presentUser(userId);
      if (!check) {
        await addUser(userId);
      }
      const verifyStatus = await dbVerifyStatus(userId);
      if (
        verifyStatus.is_verified &&
        VERIFY_EXPIRE < time() - verifyStatus.verified_time
      ) {
        verifyStatus.is_verified = false;
        await dbUpdateVerifyStatus(userId, verifyStatus);
      }
      if (text.includes("verify_")) {
        const [, token] = text.split("verify_");
        if (verifyStatus.verify_token !== token) {
          await sendMessage(
            chatId,
            "❌ <b>This token has already been used.</b>\n\n👉 <i>Click</i> /start to try again and get a fresh token! 🔄",
            null,
            "HTML"
          );
          await addu(userId);
          return;
        }
        if (verifyStatus.tokenused) {
          await sendMessage(
            chatId,
            "❌ <b>This token has already been used.</b>\n\n👉 <i>Click</i> /start to try again and get a fresh token! 🔄",
            null,
            "HTML"
          );
          await addu(userId);
          return;
        }
        verifyStatus.is_verified = true;
        verifyStatus.tokenused = true;
        verifyStatus.verified_time = time();
        await dbUpdateVerifyStatus(userId, verifyStatus);
        await sendMessage(
          chatId,
          "✅ <b>Your token has been successfully verified!</b>\n\n⏳ <b>Valid for the next 12 hours.</b>\n\n🎉 Enjoy uninterrupted access to all features! 🚀",
          null,
          "HTML"
        );
        await addu(userId);
        return;
      }
      if (verifyStatus.premium) {
        const userMentionss = `<a href="tg://user?id=${userId}">Premium User! 🎉</a>`;
        const tt = `🎉 <b>Welcome, ${userMentionss}</b>\n\n` +
        "🚀 <i>You’ve just unlocked <b>ALL</b> the exclusive features!</i>\n" +
        "✨ <b><u>No more verification required!</u></b> You now have seamless, unrestricted access to everything.\n\n" +
        "💎 <b>Your Premium Experience:</b>\n" +
        "🔓 Unlimited access to all features.\n" +
        "🌟 Priority support and a VIP experience!\n\n" +
        "💥 <b>Thanks for choosing us!</b> We’re <i>excited</i> to provide you with the best service possible.\n" +
        "💬 If you ever need anything, our team is always here to help!\n\n" +
        "<i>Enjoy the ride, Premium User!</i> 🚀";
        await sendMessage(chatId, tt, null, "HTML");
        return;
      }      
      if (verifyStatus.is_verified) {
        const userMentions = `<a href="tg://user?id=${userId}">${update.message.from.first_name || update.message.from.username}</a>`;
        const replyMessage = 
          `✨ <b>Hi ${userMentions}, Welcome!</b>\n\n` +
          "🚀 <b>Free User Benefits:</b>\n" +
          "- ⚡ <b>Basic Downloads:</b> Enjoy TeraBox access at no cost.\n" +
          "- 🆓 <b>Free Forever:</b> No need to pay to use the basic features.\n" +
          "- 🎯 <b>Simple to Use:</b> Share a link and get started!\n\n" +
          "💎 <b>Want More?</b>\n" +
          "- 🚀 <b>Upgrade to Premium:</b> Get faster downloads, skip verification, and unlock all features.\n" +
          "- ✨ Send /plan to see how premium can make your life easier.\n\n" +
          "💬 <b>Send your TeraBox link to start your free download!</b>";
        const replyMarkup = {
          inline_keyboard: [
            [{ text: "Join ❤️🚀", url: "https://t.me/teraboxai" }],
            [{ text: "Developer ⚡️", url: "https://t.me/teraboxai" }],
          ],
        };
        await sendMessage(chatId, replyMessage, replyMarkup, "HTML");
        await addu(userId);
        return;
      } else {
        if (IS_VERIFY) {
          const token = crypto.randomBytes(5).toString("hex");
          try {
            const response = await axios.get(
              `https://modijiurl.com/api?api=f392b0c6243e8985d183bfec2d8463feae650cb6&url=https://t.me/teraboxaibot?start=verify_${token}`
            );
            const link = response.data.shortenedUrl;
            verifyStatus.verify_token = token;
            verifyStatus.tokenused = false;
            verifyStatus.link = link;
            await dbUpdateVerifyStatus(userId, verifyStatus);
            const messageText = 
            `🚨 <b>Oops! Your Token Expired!</b>\n\n` +
            `⏳ <b>${VERIFY_EXPIRE / 3600} hours timeout:</b> Your free session has ended.\n\n` +
            `🔥 <b>Want to avoid this?</b> Upgrade to Premium—no tokens, no waiting, just seamless access! 🌟\n\n` +
            `👉 <b>Tap below</b> to refresh your token and enjoy another <b>12 hours</b> of access. Or, send /plan to buy Premium! 🚀\n\n` +
            `💡 <i>Free tokens keep this bot running for everyone. Thanks for understanding!</i> ❤️`;

            const replyMarkup = {
              inline_keyboard: [
                [{ text: "𝙂𝙚𝙩 𝙏𝙤𝙠𝙚𝙣 🔗", url: link }],
                [
                  {
                    text: "𝙃𝙤𝙬 𝙩𝙤 𝙑𝙚𝙧𝙞𝙛𝙮 🎥",
                    url: "https://t.me/linkhelpmodiji/2",
                  },
                ],
              ],
            };
            await sendMessage(chatId, messageText, replyMarkup, "HTML");
            await addu(userId);
            return;
          } catch (error) {
            console.error("Error fetching shortened URL:", error);
            return res.sendStatus(200);
          }
        } else {
          console.warn(
            "Verification is not enabled or user does not need verification"
          );
        }
      }
    } else if (text === "/check") {
      const verifyStatus = await dbVerifyStatus(userId);
      if (verifyStatus.premium) {
        const userMentionss = `<a href="tg://user?id=${userId}">Premium User! 🎉</a>`;
        const replyMessage = 
        `✨ <b>Welcome back, ${userMentionss}!</b>\n\n` +
        "💎 <b>You're a Premium user, no verification needed!</b>\n" +
        "✅ Enjoy uninterrupted access to all features! 🚀";
        await sendMessage(
          chatId,
          replyMessage,
          null,
          "HTML"
      );
        return;
      }
      if (verifyStatus.is_verified) {
        const remainingTime =
          VERIFY_EXPIRE - (time() - verifyStatus.verified_time);
        if (remainingTime > 0) {
          const expiryTime = getExpTime(remainingTime);
          await sendMessage(
            chatId,
            `✅ <b>Your token has been successfully verified!</b>\n\n⏳ <b>Valid for ${expiryTime}</b>\n\n🎉 Enjoy uninterrupted access to all features! 🚀`,
            null,
            "HTML"
          );
          return;
        } else {
          await sendMessage(
            chatId,
            "❌ <b>Your token has expired.</b>\n\n👉 <i>Verify again</i> to continue using the service. 🔄\n\n💡 Get back on track with a fresh token!",
            null,
            "HTML"
          );
          return;
        }
      } else {
        await sendMessage(
          chatId,
          "❌ <b>Your token is either not verified or has expired.</b>\n\n👉 <i>Use /start</i> to generate a new token and verify it. 🔄\n\n💡 Get back on track with a fresh token!",
          null,
          "HTML"
        );
        return;
      }
    } else if (
      text === "/stats" &&
      ["5958047299"].includes(userId)
    ) {
      const result = await getVerificationStatistics();
      await sendMessage(chatId, result, null, (parse_mode = "HTML"));
      return;
    } else if (
      text === "/broad" &&
      ["5958047299"].includes(userId)
    ) {
      if (update.message && update.message.reply_to_message) {
        broadcast(update.message.reply_to_message.text, userId); // Fire the broadcast request
        return;
      } else {
        await sendMessage(chatId, "Please reply to a message.");
        return;
      }
    } else if (
      text &&
      text.startsWith("/add") &&
      ["5958047299"].includes(userId)
    ) {
      const match = text.match(/^\/add (\d+)$/);
      let id;
      
      // Asynchronous function to get user details
      const getUserDetails = async (userId) => {
        const url = `${TELEGRAM_API_URL}/getChat?chat_id=${userId}`;
        try {
          const response = await fetch(url);
          const data = await response.json();
    
          if (data.ok) {
            return data.result;  // Return the user details if successful
          } else {
            throw new Error('Failed to fetch user details');
          }
        } catch (error) {
          console.error('Error fetching user details:', error);
          return null;  // Return null in case of an error
        }
      };
    
      // If a valid match is found, extract ID
      if (match) {
        id = parseInt(match[1], 10); // Extract and convert the ID
      } else {
        await sendMessage(chatId, "Invalid input format or ID not provided.");
        return;
      }
      // Proceed to add premium
      await addPremium(id);
      // Get user details asynchronously
      const details = await getUserDetails(id);
      
      if (details) {
        await sendMessage(
          details.id,
          `🎉 <b>Congratulations, ${details.first_name}${details.username ? ` (@${details.username})` : ''}!</b>\n\n`+
          `🟢 <b>Your Premium Status is Now Active!</b> 🚀\n` +
          `💎 <b>What's New?</b> You now have full access to all exclusive features, faster speeds, and no more waiting. Enjoy your VIP experience! 😎\n\n` +
          `✨ <b>Your Premium Perks:</b>\n` +
          `- 💥 Unlimited access to all features!\n` +
          `- 🚀 Lightning-fast performance!\n` +
          `- 🔓 No more token verification! 🙌\n\n` +
          `🔥 You're all set to enjoy the full power of the bot. Welcome to the premium club, ${details.first_name}! 🎉\n\n` +
          `💬 If you need help or have any questions, just let us know. We're here for you! 😉`,
          null,
          "HTML"
        );
        await sendMessage(chatId, 'done');
      } else {
        await sendMessage(
          chatId,
          `🧾 <b>Receipt of Action</b>\n\n🟢 <b>Premium Status</b>: Activated\n🆔 <b>User ID</b>: ${userId}\n\nYou have successfully purchased premium access. Enjoy your new features!`,
          null,
          "HTML"
        );
      }
      return;
    }   else if (
      text &&
      text.startsWith("/rm") &&
      ["5958047299"].includes(userId)
    ) {
      const match = text.match(/^\/rm (\d+)$/);
      let id;
      
      // Asynchronous function to get user details
      const getUserDetails = async (userId) => {
        const url = `${TELEGRAM_API_URL}/getChat?chat_id=${userId}`;
        try {
          const response = await fetch(url);
          const data = await response.json();
    
          if (data.ok) {
            return data.result;  // Return the user details if successful
          } else {
            throw new Error('Failed to fetch user details');
          }
        } catch (error) {
          console.error('Error fetching user details:', error);
          return null;  // Return null in case of an error
        }
      };
    
      // If a valid match is found, extract ID
      if (match) {
        id = parseInt(match[1], 10); // Extract and convert the ID
      } else {
        await sendMessage(chatId, "Invalid input format or ID not provided.");
        return;
      }
      // Proceed to remove premium
      await rmpremium(id);
    
      // Get user details asynchronously
      const details = await getUserDetails(id);
    
      if (details) {
        await sendMessage(
          details.id,
          `⚠️ <b>Oh no, ${details.first_name}${details.username ? ` (@${details.username})` : ''}!</b>\n\n`+
          `🔴 <b>Your Premium Status has been Removed!</b> 😞\n` +
          `💔 Unfortunately, your premium perks are no longer active.\n\n` +
          `❌ <b>What You Lose:</b>\n` +
          `- 🚫 Access to all premium features\n` +
          `- ⏳ Slower speeds and more waiting\n` +
          `- 🔓 Token verification required again\n\n` +
          `💡 We’re sorry to see you go, but we hope to welcome you back in the future! ❤️\n\n` +
          `💬 If you have any questions or want to re-upgrade, feel free to reach out! 😊`,
          null,
          "HTML"
        );
        await sendMessage(chatId,'done')
      } else {
        // If user details couldn't be fetched, fallback to sending a generic receipt message
        await sendMessage(
          chatId,
          `🧾 <b>Receipt of Action</b>\n\n🔴 <b>Premium Status</b>: Removed\n🆔 <b>User ID</b>: ${userId}\n\nYour premium access has been revoked. Thank you for being with us!`,
          null,
          "HTML"
        );
      }
    
      return;
    } else if (text === "/plan") {
      const verifyStatus = await dbVerifyStatus(userId);
      if (verifyStatus.premium) {
        const userMentionss = `<a href="tg://user?id=${userId}">${update.message.from.first_name || update.message.from.username}</a>`;
        const tt = `🎉 <b>Welcome Back, ${userMentionss}!</b>\n\n` +
          "💎 <b>You are already a Premium User!</b>\n" +
          "✨ Enjoy your seamless, unrestricted access to all exclusive features.\n\n" +
          "🚀 <b>No need to buy again</b>—your premium benefits are still active and ready to use.\n\n" +
          "🌟 Thank you for being a valued part of our community. We’re here to ensure you continue to have the best experience possible.\n\n" +
          "💬 If you have any questions or need assistance, our team is always here to help.\n\n" +
          "<i>Keep enjoying your premium perks, and have a fantastic day!</i> 🚀";
        await sendMessage(chatId,tt,null,'HTML')
        return
      }
      const planDetails = 
        `🌟 <b>🌟 Premium Plan Details 🌟</b>\n\n` +
        `💰 <b>💎 Monthly Plan:</b> <u>$2 per month</u>\n` +
        `💰 <b>💎 Yearly Plan:</b> <u>$25 per year (save 20%)</u>\n\n` +
        `🎁 <b>What's Included?</b>\n` +
        `🔥 🚀 <i>Unlimited access to all premium features!</i>\n` +
        `🔒 🛡️ <i>No verification needed ever again!</i>\n` +
        `🌐 💎 <i>Priority support to get you the best experience!</i>\n\n` +
        `⚡ <b>Ready to Unlock Premium?</b>\n` +
        `🗨️ <b>Contact our Admin to buy and start enjoying:</b>\n` +
        `<a href="tg://user?id=5958047299">🧑‍💻 Admin Username</a>\n` +
        `Tap the name to chat and complete your purchase!\n\n` +
        `💥 <i>Unlock your full potential with Premium today!</i>`;
      await sendMessage(chatId, planDetails, null, "HTML");
      return;
    }else if (text) {
      const check = await checkUserMembership(userId);
      if (!check) {
        await sendMessage(
          chatId,
          "🚫 <b>Oops! You need to join our channel to use the bot.</b>\n\n👉 <b>Join now:</b> @teraboxai\n\n💎 <i>Unlock free access to all the magic!</i>",
          null,
          "HTML"
        );
        return;
      }
      const verifyStatus = await dbVerifyStatus(userId);
      if (
        verifyStatus.is_verified &&
        VERIFY_EXPIRE < time() - verifyStatus.verified_time
      ) {
        verifyStatus.is_verified = false;
        await dbUpdateVerifyStatus(userId, verifyStatus);
      }
      if (!verifyStatus.premium && !verifyStatus.is_verified) {
        await sendMessage(
          chatId,
          "🚫 <b>You need to verify your token to use the bot.</b>\n\n👉 <b>Click</b> /start to generate a new token and verify it. 🔄\n\n💡 <i>Get back on track and enjoy uninterrupted access!</i>",
          null,
          "HTML"
        );
        return;
      }
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const valid_domains = [
        "terabox.com",
        "nephobox.com",
        "4funbox.com",
        "mirrobox.com",
        "terabox.link",
        "momerybox.com",
        "teraboxapp.com",
        "terafileshare.com",
        "1024tera.com",
        "xnxx",
        "terabox.app",
        "gibibox.com",
        "goaibox.com",
        "terasharelink.com",
        "teraboxlink.com",
        "www.terabox.app",
        "terabox.fun",
        "www.terabox.com",
        "www.1024tera.com",
        "teraboxshare.com",
        "www.mirrobox.com",
        "www.nephobox.com",
        "freeterabox.com",
        "www.freeterabox.com",
        "4funbox.co",
      ];

      // Function to check if URL contains a valid domain
      // Function to check if URL contains a valid domain
      function checkUrlForValidDomain(url) {
        try {
          const urlObj = new URL(url); // Parse the URL
          const domain = urlObj.hostname.toLowerCase(); // Extract domain from the URL and convert to lowercase

          // Check if the domain matches any in the valid_domains list
          return valid_domains.some((validDomain) =>
            domain.includes(validDomain)
          );
        } catch (error) {
          return false; // Return false if the URL is invalid
        }
      }
      if (checkUrlForValidDomain(text)) {
        const ch = await sendMessage(
          chatId,
          "🔗 Processing your request... Please wait a moment."
        );
        const mesid = ch.message_id;
        await sleep(500);
        await deleteMessage(chatId, mesid);
        await axios.post("http://82.25.105.146:5000/send_message", {
          user_id: chatId,
          url: text,
          mention: userMention,
        });
      } else {
        await sendMessage(
          chatId,
          "❌ Invalid TeraBox link. Please try again with a valid link."
        );
        return;
      }
    }
  } else {
    return;
  }
}
module.exports = async (req, res) => {
  if (req.method === "POST") {
    try {
      const update = req.body;
      await handleUpdate(update);
      res.status(200).send("OK");
    } catch (error) {
      console.error("Error handling update:", error);
      res.status(500).send("Error");
    }
  } else if (req.method === "GET") {
    try {
      const url = `${TELEGRAM_API_URL}/getMe`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.ok) {
        res.status(200).json(data.result);
      } else {
        res.status(500).json({ error: "Failed to fetch bot information" });
      }
    } catch (error) {
      console.error("Error fetching bot info:", error);
      res.status(500).send("Error fetching bot info");
    }
  } else {
    res.status(405).send("Method Not Allowed");
  }
};

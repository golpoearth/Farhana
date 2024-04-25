// Load environment variables
require('dotenv').config();

// Import necessary libraries
const TelegramBot = require('node-telegram-bot-api');
const Excel = require('excel4node');
const fs = require('fs');

// Initialize Telegram bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Define channel ID and log channel ID
const channelID = '@golpoearth';
const logChannelID = '@logchanneloldcoin';

// Object to store join task status for each user
let joinTasks = {};

// Object to store user last mining timestamp
let lastMiningTime = {};

// Object to store user balances and wallet addresses
let balances = {};
let wallets = {};

// Object to store referral links and their owners
let referrals = {};

// Object to store the last time a command was received from each user
let lastCommandTime = {};

// Command rate limiting
const commandCooldown = 5000; // 5 seconds

// Define the rate at which oldcoins are generated (100 per second)
const coinsPerSecond = 100;
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const referralReward = 500;
const botUsername = 'tetdtdtgtgbot'; // Replace 'tetdtdtgtgbot' with your bot's username

// Load admin IDs from environment variables
const adminIds = [
    process.env.ADMIN_ID_1,
    process.env.ADMIN_ID_2
];

// Function to check if a user is an admin
function isAdmin(userId) {
    return adminIds.includes(String(userId));
}

// Function to generate referral link
function generateReferralLink(userId) {
    return `https://t.me/${botUsername}?start=${userId}`;
}

// Function to send welcome message with inline keyboard
function sendWelcomeMessage(chatId, withCheckButton = false) {
    const message = withCheckButton ?
        'Welcome to Golpo Earth! Please join our channel @golpoearth to continue.' :
        'Welcome to Golpo Earth! You have successfully joined our channel @golpoearth.';

    const buttons = withCheckButton ?
        [[{ text: 'Join Channel', url: 'https://t.me/golpoearth' }, { text: 'Check', callback_data: 'check' }]] :
        [[{ text: 'Join Channel', url: 'https://t.me/golpoearth' }]];

    bot.sendMessage(chatId, message, {
        reply_markup: {
            inline_keyboard: buttons
        }
    });
}

// Function to send main menu with inline options and additional information
function sendMainMenu(chatId, isAdmin) {
    const userId = chatId; // For simplicity, we use chatId as userId
    let miningButtonText = "";
    if (lastMiningTime[userId] && Date.now() - lastMiningTime[userId] < millisecondsPerDay) {
        miningButtonText = "⛏️ Mining";
    } else {
        miningButtonText = "Click to start";
    }
    const balance = balances[userId] || 0;
    const referralLink = generateReferralLink(userId); // Generate referral link for the user
    const walletAddress = wallets[userId] || 'Not set'; // Get wallet address or display 'Not set'

    const message = `*Main Menu*\nMining: ${miningButtonText}\nBalance: ${balance} oldcoins\nWallet Address: ${walletAddress}`;

    const inlineKeyboard = [
        [{ text: miningButtonText, callback_data: 'mining' }, { text: '💰 Balance', callback_data: 'balance' }],
        [{ text: 'Share Link', url: `https://t.me/share/url?url=${encodeURIComponent("🚀 *Join Golpo Earth* 🚀\n\nHey there! 👋\n\nI'm enjoying Golpo Earth, a platform where you can earn oldcoins by sharing stories and interacting with others.\n\n👉 Click the link below to join:\n" + referralLink + "\n\nLet's explore together! 🌍")}` }, { text: '👥 Referrals', callback_data: 'referrals' }],
        [{ text: '💼 Wallet', callback_data: 'wallet' }], // Add Wallet button
        [{ text: 'Manage User', callback_data: 'manageuser' }, { text: 'Export Data', callback_data: 'exportdata' }] // Add Manage User and Export Data buttons
    ];

    if (!isAdmin) {
        inlineKeyboard.pop(); // Remove the last row (Manage User and Export Data buttons) if user is not admin
    }

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: inlineKeyboard
        }
    });
}

// Function to start mining for a user
function startMining(userId) {
    if (!lastMiningTime[userId] || Date.now() - lastMiningTime[userId] >= millisecondsPerDay) {
        if (!balances[userId]) {
            balances[userId] = 0;
        }
        lastMiningTime[userId] = Date.now();
        setInterval(() => {
            balances[userId] += coinsPerSecond;
        }, 1000); // Generate coins every second
    }
}

// Function to display balance
function displayBalance(chatId) {
    const userId = chatId; // For simplicity, we use chatId as userId
    const balance = balances[userId] || 0;
    bot.sendMessage(chatId, `Your balance: ${balance} oldcoins`);
}

// Function to generate referral link and show referrals
function handleReferral(chatId, userId) {
    const referralLink = generateReferralLink(userId); // Generate referral link for the user
    const userReferrals = referrals[userId] || [];

    let message = `*Your Referral Link:*\n${referralLink}\n*Your Referrals:*`;

    if (userReferrals.length === 0) {
        message += "\nNo referrals yet.";
    } else {
        userReferrals.forEach(referral => {
            message += `\n- [User ${referral}]`;
        });
    }

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
    }).then(() => {
        sendMainMenu(chatId, isAdmin(userId)); // Send the main menu after showing referral details
    }).catch((error) => {
        console.error("Error sending message:", error);
    });
}

// Function to handle wallet setting
function handleWallet(chatId, userId) {
    const walletAddress = wallets[userId] || 'Not set';

    if (walletAddress !== 'Not set') {
        // If wallet address is already set, inform the user
        bot.sendMessage(chatId, `Your wallet address is already saved: ${walletAddress}`);
    } else {
        // If wallet address is not set, request the user to send their wallet address
        bot.sendMessage(chatId, 'Please send your wallet address:');
    }
}

// Function to handle user management
function handleManageUser(chatId, userId) {
    // Request user ID for user details
    bot.sendMessage(chatId, 'Please send the user ID:');
}

// Function to handle user details display
function handleUserDetails(chatId, userId) {
    // Get user details
    const balance = balances[userId] || 0;
    const totalReferrals = referrals[userId] ? referrals[userId].length : 0;
    const walletAddress = wallets[userId] || 'Not set';

    bot.getChat(userId)
        .then(user => {
            // Format user details
            const userDetails = `*User Details*\nID: ${userId}\nName: ${user.first_name} ${user.last_name || ''}\nUsername: ${user.username || 'Not available'}\nBalance: ${balance} oldcoins\nTotal Referrals: ${totalReferrals}\nWallet Address: ${walletAddress}`;

            // Send user details
            bot.sendMessage(chatId, userDetails, { parse_mode: 'Markdown' });
        })
        .catch(error => {
            console.error("Error getting user details:", error);
            bot.sendMessage(chatId, 'An error occurred while fetching user details.');
        });
}

// Function to export user data
function handleExportData(chatId) {
    // Export user data
    exportUserData(chatId);
}

// Function to send mystery box message
function sendMysteryBox(chatId) {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Open Mystery Box', callback_data: 'openmysterybox' }]
            ]
        }
    };

    bot.sendMessage(chatId, '🎁 *Congratulations! You received a Mystery Box.* 🎁\n\nSend your Twitter username and follow our Twitter account to open it.', { parse_mode: 'Markdown' }, options);
}

// Listen for /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const referrer = msg.text.split(' ')[1]; // Get referrer ID from start parameter

    if (joinTasks[userId]) {
        // If the user has completed the join task, start mining if they click the mining button
        sendMainMenu(chatId, isAdmin(userId));
    } else {
        // If the user has not completed the join task, check if they are a member of the channel
        isMember(userId).then((isMember) => {
            if (isMember) {
                // If the user is a member, mark the join task as completed and send the new welcome message
                joinTasks[userId] = true;
                sendWelcomeMessage(chatId, true); // Send welcome message with Check button
            } else {
                // If the user is not a member, send the "join channel" message
                sendJoinChannelMessage(chatId);
            }
        });
    }

    // If a referrer is provided and it's not the same as the referred user, add the referrer to the user's referral list
    if (referrer && referrer !== userId && !referrals[userId] && !referrals[referrer]?.includes(userId)) {
        if (!referrals[referrer]) {
            referrals[referrer] = [];
        }
        referrals[referrer].push(userId);
        if (userId !== referrer) {
            referrals[userId] = []; // Initialize referral list for the new user
            balances[referrer] = (balances[referrer] || 0) + referralReward; // Reward the referrer with oldcoins
            // Show referral message to the referrer
            bot.sendMessage(referrer, `Congratulations! You referred a new user and received ${referralReward} oldcoins.`);
        }
    } else if (referrer && referrer === userId) {
        bot.sendMessage(chatId, "Self-referral is not allowed.");
    }
});

// Listen for callback queries
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    // If the user clicks the 'Mining', 'Balance', 'Referrals', 'Manage User', or 'Export Data' button
    if (data === 'mining') {
        if (joinTasks[userId]) {
            // If the user has completed the join task, start mining
            startMining(userId);
            sendMainMenu(chatId, isAdmin(userId));
        } else {
            // If the user has not completed the join task, prompt them to do so
            sendWelcomeMessage(chatId, isAdmin(userId));
        }
    } else if (data === 'balance') {
        // Check balance
        displayBalance(chatId);
    } else if (data === 'referrals') {
        // Show referral link and referrals
        handleReferral(chatId, userId);
    } else if (data === 'manageuser') {
        // Manage user
        handleManageUser(chatId, userId);
    } else if (data === 'exportdata') {
        // Export user data
        handleExportData(chatId);
    } else if (data === 'check') {
        // If the user clicks the 'Check' button
        isMember(userId).then((isMember) => {
            if (isMember) {
                sendMainMenu(chatId, isAdmin(userId));
                // Delete the welcome message after sending the main menu
                bot.deleteMessage(chatId, query.message.message_id)
                    .catch((error) => console.error("Error deleting message:", error));
            } else {
                bot.sendMessage(chatId, 'You have not joined our channel @golpoearth yet. Please join to access the content.');
            }
        });
    } else if (data === 'wallet') {
        // Handle wallet setting
        handleWallet(chatId, userId);
    } else if (data === 'openmysterybox') {
        // Handle opening mystery box
        bot.sendMessage(chatId, '🎉 *Congratulations!* 🎉\n\nYou received *1000 USDT* and a *5000 Oldcoin Voucher NFT*!\n\n*Reward Details:*\nUSDT: 1000\nOldcoin Voucher NFT: 5000\n\nThese rewards have been added to your account.');
        // Update user balance
        balances[userId] = (balances[userId] || 0) + 5000;
        // Send updated main menu
        sendMainMenu(chatId, isAdmin(userId));
    }
});

// Listen for new members joining the channel
bot.on('new_chat_members', (msg) => {
    const userId = msg.from.id;
    joinTasks[userId] = true; // Mark the join task as completed for the new member
    sendWelcomeMessage(msg.chat.id, true); // Send welcome message with Check button
});

// Listen for messages
bot.on('message', (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const message = msg.text;

    // Check if the user is an admin
    if (isAdmin(userId)) {
        // Handle commands from admin
        if (message === '/adminpanel') {
            sendAdminPanel(chatId);
        } else if (lastCommandTime[userId] && Date.now() - lastCommandTime[userId] > commandCooldown) {
            // Handle user ID sent for user details
            if (message && /^\d+$/.test(message)) {
                const targetUserId = parseInt(message);
                handleUserDetails(chatId, targetUserId);
                return; // Exit the function to prevent further processing
            }
            lastCommandTime[userId] = Date.now();
        }
    }

    // Update the last command time for the user
    lastCommandTime[userId] = Date.now();

    // If the message is a wallet address, save it
    if (message && message.length > 0 && message.length <= 42 && /^[A-Za-z0-9_-]+$/.test(message)) {
        wallets[userId] = message;
        bot.sendMessage(chatId, 'Your wallet address has been saved.');
        // Save user's details to log channel
        const userDetails = `
            User ID: ${userId}
            Username: ${msg.from.username || 'Not available'}
            First Name: ${msg.from.first_name}
            Last Name: ${msg.from.last_name || 'Not available'}
            Wallet Address: ${message}
            `;
        bot.sendMessage(logChannelID, userDetails);
        sendMainMenu(chatId, isAdmin(userId)); // Show main menu after saving the wallet address
    } else if (message && message.startsWith('@') && !message.includes(' ')) {
        // If the message is a Twitter username
        sendMysteryBox(chatId);
    }
});

// Function to check if user is a member of the channel
function isMember(userId) {
    return bot.getChatMember(channelID, userId)
        .then((chatMember) => {
            return chatMember.status === 'member' || chatMember.status === 'administrator';
        })
        .catch((error) => {
            console.error("Error checking channel membership:", error);
            return false;
        });
}

// Function to export user data
function exportUserData(chatId) {
    // Create a new Excel workbook
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('User Data');

    // Add headers to the worksheet
    const headings = ['User ID', 'Username', 'First Name', 'Last Name', 'Wallet Address', 'Balance', 'Total Referrals'];
    worksheet.row(1).values = headings;

    // Add data to the worksheet
    let rowIndex = 2;
    for (const userId in wallets) {
        const username = wallets[userId] || 'Not available';
        const user = bot.getChat(userId)
            .then((user) => {
                const row = [
                    userId,
                    user.username || 'Not available',
                    user.first_name,
                    user.last_name || 'Not available',
                    wallets[userId] || 'Not set',
                    balances[userId] || 0,
                    referrals[userId] ? referrals[userId].length : 0
                ];
                worksheet.row(rowIndex++).values = row;
            })
            .catch((error) => {
                console.error("Error fetching user:", error);
                rowIndex++;
            });
    }

    // Save the workbook
    const fileName = 'user_data.xlsx';
    workbook.write(fileName, (err, stats) => {
        if (err) {
            console.error("Error exporting user data:", err);
            bot.sendMessage(chatId, 'An error occurred while exporting user data.');
        } else {
            console.log("User data exported successfully:", stats);
            bot.sendDocument(chatId, fileName, {
                caption: 'Here is the user data.'
            });
        }
    });
}

// Function to load user data from JSON file
function loadUserData() {
    fs.readFile('userdata.json', (err, data) => {
        if (err) {
            console.error("Error reading userdata.json:", err);
            return;
        }

        try {
            const userData = JSON.parse(data);
            balances = userData.balances || {};
            wallets = userData.wallets || {};
            referrals = userData.referrals || {};
            console.log("User data loaded successfully.");
        } catch (error) {
            console.error("Error parsing userdata.json:", error);
        }
    });
}

// Function to save user data to JSON file
function saveUserData() {
    const userData = {
        balances: balances,
        wallets: wallets,
        referrals: referrals
    };

    fs.writeFile('userdata.json', JSON.stringify(userData), (err) => {
        if (err) {
            console.error("Error saving userdata.json:", err);
            return;
        }
        console.log("User data saved successfully.");
    });
}

// Load user data on bot startup
loadUserData();

// Save user data periodically
setInterval(saveUserData, 60000); // Save user data every minute

const chalk = require("chalk");
const { connectToWhatsApp } = require("./connection");
const { generateResponse, detectMessageType } = require("./ai");
const settings = require("./settings");

// Simple cooldown tracker
const cooldowns = new Map();

async function startBot() {
    console.clear();
    console.log(chalk.blue.bold("========================================"));
    console.log(chalk.white.bold(`   ${settings.botName} - WhatsApp AI Bot   `));
    console.log(chalk.blue.bold("========================================"));
    console.log(chalk.yellow("Starting loading animation..."));
    
    // Fake loading animation
    const loader = ["|", "/", "-", "\\"];
    let i = 0;
    const loadInterval = setInterval(() => {
        process.stdout.write(`\r${chalk.cyan("Initializing system...")} ${loader[i++ % loader.length]}`);
    }, 100);

    setTimeout(async () => {
        clearInterval(loadInterval);
        process.stdout.write("\r");
        
        try {
            const sock = await connectToWhatsApp();

            sock.ev.on("messages.upsert", async (chatUpdate) => {
                try {
                    const m = chatUpdate.messages[0];
                    if (!m.message) return;
                    if (m.key.fromMe) return;

                    const remoteJid = m.key.remoteJid;
                    const isGroup = remoteJid.endsWith("@g.us");
                    const sender = isGroup ? m.key.participant : remoteJid;
                    const pushName = m.pushName || "User";
                    
                    // Get message text
                    const messageType = Object.keys(m.message)[0];
                    let body = "";
                    if (messageType === "conversation") body = m.message.conversation;
                    else if (messageType === "extendedTextMessage") body = m.message.extendedTextMessage.text;
                    else if (messageType === "imageMessage") body = m.message.imageMessage.caption;
                    else if (messageType === "videoMessage") body = m.message.videoMessage.caption;

                    if (!body) return;

                    // Check if AI is enabled for this chat type
                    if (isGroup && !settings.groupAiMode) return;
                    if (!isGroup && !settings.privateAiMode) return;

                    // Cooldown check
                    const now = Date.now();
                    if (cooldowns.has(sender)) {
                        const expirationTime = cooldowns.get(sender) + settings.cooldownTime;
                        if (now < expirationTime) {
                            console.log(chalk.gray(`[ SPAM DETECTED ] From ${sender}`));
                            return;
                        }
                    }
                    cooldowns.set(sender, now);

                    console.log(chalk.blue(`\n[ MESSAGE FROM ${pushName} (${sender.split("@")[0]}) ]`));
                    process.stdout.write("\u0007"); // Beep sound
                    console.log(chalk.white(`Content: ${body}`));

                    // Send typing indicator
                    await sock.sendPresenceUpdate("composing", remoteJid);

                    // Detect message type (optional logging)
                    const type = detectMessageType(body);
                    console.log(chalk.gray(`Detected type: ${type}`));

                    // Generate AI Response
                    const response = await generateResponse(sender, body);

                    // Split long messages if necessary
                    const maxLength = 2000;
                    if (response.length > maxLength) {
                        const chunks = response.match(new RegExp(`.{1,${maxLength}}`, "g"));
                        for (const chunk of chunks) {
                            await sock.sendMessage(remoteJid, { text: chunk }, { quoted: m });
                        }
                    } else {
                        await sock.sendMessage(remoteJid, { text: response }, { quoted: m });
                    }

                    console.log(chalk.green(`[ AI REPLY SENT ]`));
                    
                    // Stop typing indicator
                    await sock.sendPresenceUpdate("paused", remoteJid);

                } catch (err) {
                    console.error(chalk.red("[ ERROR PROCESSING MESSAGE ]"), err);
                }
            });

        } catch (err) {
            console.error(chalk.red("[ FATAL ERROR ]"), err);
            process.exit(1);
        }
    }, 2000);
}

// Handle unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

startBot();

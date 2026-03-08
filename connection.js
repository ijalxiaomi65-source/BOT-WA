const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs-extra");
const chalk = require("chalk");
const readline = require("readline");
const settings = require("./settings");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false, // We use pairing code
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.creds, pino({ level: "silent" })),
        },
        browser: Browsers.macOS("Desktop"), // Required for pairing code
        syncFullHistory: false
    });

    // Pairing Code Logic
    if (!sock.authState.creds.registered) {
        console.log(chalk.cyan("\n[ WAITING FOR PAIRING ]"));
        const phoneNumber = await question(chalk.yellow("Enter your WhatsApp number (with country code, e.g., 628xxx): "));
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(chalk.green(`\nYOUR PAIRING CODE: `) + chalk.white.bgBlue.bold(` ${code} `));
        console.log(chalk.gray("Enter this code in your WhatsApp: Settings > Linked Devices > Link with Phone Number\n"));
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) ? 
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
            
            console.log(chalk.red("[ CONNECTION CLOSED ]"), "Reason:", lastDisconnect.error?.message);
            
            if (shouldReconnect) {
                console.log(chalk.yellow("[ RECONNECTING... ]"));
                connectToWhatsApp();
            } else {
                console.log(chalk.red("[ LOGGED OUT ]"), "Please delete auth_info_baileys folder and restart.");
            }
        } else if (connection === "open") {
            console.log(chalk.green.bold("\n[ BOT CONNECTED ]"));
            console.log(chalk.cyan(`Logged in as: ${sock.user.name || sock.user.id}`));
        }
    });

    sock.ev.on("creds.update", saveCreds);

    return sock;
}

module.exports = { connectToWhatsApp };

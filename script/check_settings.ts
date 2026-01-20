import Database from "better-sqlite3";

const db = new Database('sqlite.db', { readonly: true });

try {
    const settings = db.prepare('SELECT * FROM bot_settings LIMIT 1').get() as any;

    console.log("=== Bot Settings Check ===");
    if (settings) {
        console.log(`Active: ${settings.is_active ? 'Yes' : 'No'}`);
        console.log(`Testnet: ${settings.is_testnet ? 'Yes' : 'No'}`);
        console.log(`Binance API Key: ${settings.binance_api_key ? 'Configured (Ends with ' + settings.binance_api_key.slice(-4) + ')' : 'MISSING'}`);
        console.log(`Binance Secret: ${settings.binance_api_secret ? 'Configured' : 'MISSING'}`);
        console.log(`Auto Trading: ${settings.auto_trading_enabled ? 'Enabled' : 'Disabled'}`);
    } else {
        console.log("No settings found in database.");
    }
} catch (error) {
    console.error("Error reading settings:", error);
}

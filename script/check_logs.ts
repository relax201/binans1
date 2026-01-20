import Database from "better-sqlite3";

const db = new Database('sqlite.db', { readonly: true });

try {
    const logs = db.prepare(`
    SELECT * FROM activity_logs 
    ORDER BY timestamp DESC 
    LIMIT 20
  `).all();

    console.log("=== Recent Activity Logs ===");
    logs.forEach((log: any) => {
        console.log(`[${new Date(log.timestamp).toLocaleString()}] [${log.level}] ${log.message}`);
        if (log.details) console.log(`   Details: ${log.details}`);
    });

    const errors = db.prepare(`
    SELECT * FROM activity_logs 
    WHERE level = 'error'
    ORDER BY timestamp DESC 
    LIMIT 10
  `).all();

    if (errors.length > 0) {
        console.log("\n=== Recent Errors ===");
        errors.forEach((log: any) => {
            console.log(`[${new Date(log.timestamp).toLocaleString()}] ${log.message}`);
            if (log.details) console.log(`   Details: ${log.details}`);
        });
    } else {
        console.log("\nNo recent errors found in database.");
    }
} catch (error) {
    console.error("Error reading logs:", error);
}

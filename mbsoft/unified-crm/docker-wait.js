const net = require('net');

const host = process.env.DB_HOST || 'db';
const port = Number(process.env.DB_PORT || 5432);

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
    for(let i = 0; i < 60; i++) {
        const ok = await new Promise(resolve => {
            const socket = new net.Socket();
            socket.on('connect', () => { socket.destroy(); resolve(true); });
            socket.on('error', () => resolve(false));
            socket.connect(port, host);
        });
        if (ok) {
            console.log("✅ PostgreSQL 端口连通成功");
            return;
        }
        await wait(1000);
    }
    console.error("❌ PostgreSQL 连接超时，请检查数据库服务");
    process.exit(1);
}
main();

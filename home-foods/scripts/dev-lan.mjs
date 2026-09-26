import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

const addresses = Object.values(networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)).map(a => a.address);
if (!addresses.length) throw new Error('No private IPv4 network found. Connect to your trusted Wi-Fi and retry.');
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use a development port from 1024 to 65535.');
console.log('Phone and computer must use the same trusted Wi-Fi. Open one of:');
for (const address of addresses) console.log(`  http://${address}:${port}`);
console.log('HTTP LAN testing supports navigation and manual addresses. iPhone GPS requires trusted HTTPS.');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '0.0.0.0', '--port', String(port)], {
  stdio: 'inherit', env: { ...process.env, HOMEFOODS_DEV_LAN_HOSTS: addresses.join(',') },
});
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));

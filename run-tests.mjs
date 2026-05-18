import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const r = spawnSync(args[0], args.slice(1), { encoding: 'utf8', env: process.env });
console.log('STDOUT:\n' + r.stdout);
console.log('STDERR:\n' + r.stderr);
console.log('STATUS:', r.status);

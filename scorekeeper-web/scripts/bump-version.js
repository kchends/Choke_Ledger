const fs = require('fs');
const child = require('child_process');
function readVersion(){ return fs.readFileSync('VERSION','utf8').trim(); }
function writeVersion(v){ fs.writeFileSync('VERSION', v + '\n'); }
function bumpPatch(v){ const m = v.match(/v?(\d+)\.(\d+)\.(\d+)/); if(!m) throw new Error('Invalid version'); return 'v'+(Number(m[1]))+'.'+(Number(m[2]))+'.'+(Number(m[3])+1); }
function prependChangelog(version, message){ const date = new Date().toISOString().slice(0,10); const changelog = fs.readFileSync('CHANGELOG.md','utf8'); const header = changelog.split('\n').slice(0,4).join('\n') + '\n\n'; const rest = changelog.split('\n').slice(4).join('\n'); const entry = `## ${version} - ${date}\n- ${message.replace(/\n/g,'\n- ')}\n\n---\n\n`;
 fs.writeFileSync('CHANGELOG.md', header + entry + rest);
}
async function main(){ const cur = readVersion(); const next = bumpPatch(cur); const msg = process.argv.slice(2).join(' ') || 'Misc changes'; writeVersion(next); prependChangelog(next, msg); child.execSync('git add VERSION CHANGELOG.md', {stdio:'inherit'}); child.execSync(`git commit -m "Bump version to ${next}: ${msg}\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"`, {stdio:'inherit'}); child.execSync(`git tag ${next}`, {stdio:'inherit'}); child.execSync('git push', {stdio:'inherit'}); child.execSync('git push --tags', {stdio:'inherit'}); console.log('Bumped to', next); }
main().catch(e=>{ console.error(e); process.exit(1); });
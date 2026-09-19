const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const compiled = ts.transpileModule(fs.readFileSync('lib/music-request.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleExports = {};
vm.runInNewContext(compiled, { exports: moduleExports });
const { parseMusicRequest: parse, musicReply } = moduleExports;
for (const input of ['play More and More by Joe', 'Jarvis, please play More and More by Joe on Apple Music', 'Can you play "More and More" by Joe?']) {
  assert.equal(parse(input).action, 'play_song'); assert.equal(parse(input).title, 'More and More'); assert.equal(parse(input).artist, 'Joe');
}
for (const [input, action] of [['pause music', 'pause'], ['lower the volume', 'volume_down'], ['play Apple Music', 'play'], ['stop music', 'stop'], ['skip this song', 'next']]) assert.equal(parse(input).action, action);
for (const input of ['Who sings More and More?', 'Do not play music', 'play chess', 'create a Word document', 'How do I play music?']) assert.equal(parse(input), null);
assert.equal(musicReply('play', { error: 'Not connected' }), 'Not connected');
assert.equal(musicReply('play_song', { ok: true, message: 'Playing More and More by Joe.' }), 'Playing More and More by Joe.');
assert.equal(musicReply('play', {}), 'Music did not confirm the command.');
console.log('Music request and truthful-result checks passed.');

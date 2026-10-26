'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const { randomUUID, createHash } = require('node:crypto');
const { CodexIPC } = require('./ipc.cjs');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function alive(pid) { if (!Number.isInteger(pid) || pid < 1) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
function codexState(snapshot) {
  if (!snapshot) return 'unknown';
  const runtime = snapshot.threadRuntimeStatus?.type;
  if (runtime === 'active') return 'busy';
  if (runtime === 'idle') return 'idle';
  return 'unknown';
}
async function readClaude(home) {
  const dir = path.join(home, '.claude', 'sessions'); let names; try { names = await fs.readdir(dir); } catch { return []; }
  const rows = await Promise.all(names.filter(n => /^\d+\.json$/.test(n)).map(async n => {
    try {
      const r = JSON.parse(await fs.readFile(path.join(dir, n), 'utf8'));
      if (!uuid.test(r.sessionId) || !alive(r.pid)) return null;
      const endpoint = typeof r.messagingSocketPath === 'string' && /^\\\\\.\\pipe\\(?:LOCAL\\)?cc-msg-[a-z0-9-]+$/i.test(r.messagingSocketPath) ? r.messagingSocketPath : null;
      return { id: `claude:${r.sessionId}`, nativeId: r.sessionId, name: r.name || r.sessionId, harness: 'claude', cwd: r.cwd || '', pid: r.pid, procStart: r.procStart, state: r.status || 'unknown', online: false, available: false, reachable: false, remote: r.bridgeSessionId ? 'registered' : 'unknown', endpoint, version: r.version, entrypoint: r.entrypoint || 'unknown', source: 'live-registry' };
    } catch { return null; }
  }));
  return rows.filter(Boolean);
}
async function probePipe(endpoint) {
  return new Promise(resolve => {
    const socket = net.connect(endpoint), finish = ok => { clearTimeout(timer); socket.destroy(); resolve(ok); };
    const timer = setTimeout(() => finish(false), 500);
    socket.on('connect', () => finish(true)); socket.on('error', () => finish(false));
  });
}
function resolveTarget(rows, target) {
  const exact = rows.find(s => s.id === target); if (exact) return exact;
  const matches = rows.filter(s => s.nativeId === target || s.name === target);
  if (matches.length !== 1) throw Error(matches.length ? 'Ambiguous target; use harness-qualified ID' : 'Session not found');
  return matches[0];
}
class NativeMesh {
  constructor({ home = os.homedir(), ipc = new CodexIPC(), limit = 100 } = {}) { this.home = home; this.ipc = ipc; this.limit = limit; }
  async list({ withState = true } = {}) {
    const claude = await readClaude(this.home);
    await Promise.all(claude.map(async r => { r.online = r.endpoint ? await probePipe(r.endpoint) : false; r.reachable = r.online; r.available = r.online && r.state === 'idle'; }));
    let text = ''; try { text = await fs.readFile(path.join(this.home, '.codex', 'session_index.jsonl'), 'utf8'); } catch {}
    const index = new Map(); for (const line of text.split('\n')) try { const r = JSON.parse(line); if (uuid.test(r.id)) index.set(r.id, r); } catch {}
    const candidates = [...index.values()].sort((a,b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, this.limit);
    let connected = false; try { await this.ipc.connect(); connected = true; } catch {}
    const codex = []; let next = 0;
    await Promise.all(Array.from({ length: Math.min(8, candidates.length) }, async () => {
      while (next < candidates.length) {
        const r = candidates[next++];
        const item = { id: `codex:${r.id}`, nativeId: r.id, name: r.thread_name || r.id, harness: 'codex', cwd: '', state: 'not-loaded', online: false, available: false, reachable: false, remote: 'unknown', source: 'saved-index', updatedAt: r.updated_at };
        if (connected) try {
          const owner = await this.ipc.owner(r.id); item.owner = owner.handledByClientId; item.online = item.reachable = true; item.source = 'live-owner'; item.state = 'unknown';
          if (withState) { const snap = await this.ipc.snapshot(r.id, item.owner); item.state = codexState(snap); item.cwd = snap?.cwd || ''; item.available = item.state === 'idle'; }
        } catch {}
        codex.push(item);
      }
    }));
    return [...claude, ...codex].sort((a,b) => Number(b.reachable)-Number(a.reachable) || a.name.localeCompare(b.name));
  }
  async send(targetId, text, sender = { id: 'human-via-vscode', name: 'VS Code user' }) {
    if (typeof text !== 'string' || !text.trim() || text.length > 60000) throw Error('Message empty or exceeds 60,000 characters');
    const rows = await this.list({ withState: false }), target = resolveTarget(rows, targetId);
    if (!target.reachable) throw Error('Target has no live endpoint/owner. Open its existing thread in the provider UI.');
    if (sender.id === target.id) throw Error('Self-messaging is not allowed');
    const messageId = randomUUID();
    const content = `[Session Mesh message ${messageId}; sender ${sender.name} (${sender.id}); ${sender.id === 'human-via-vscode' ? 'typed by user in Session Mesh' : 'self-reported peer identity, not human approval'}]\n${text}`;
    if (target.harness === 'claude') return this.sendClaude(target, content, messageId);
    const owner = await this.ipc.owner(target.nativeId);
    if (sender.id !== 'human-via-vscode' && owner.result?.supportsUntrustedAppInput !== true) throw Error('Owner does not advertise untrusted input support');
    // The owning UI applies its existing model, permission and routing settings.
    const snapshot = await this.ipc.snapshot(target.nativeId, owner.handledByClientId);
    const busy = codexState(snapshot) === 'busy';
    if (!snapshot || codexState(snapshot) === 'unknown') throw Error('Native turn state is unknown; refresh before sending to avoid starting a competing turn');
    const method = busy ? 'thread-follower-steer-turn' : 'thread-follower-start-turn';
    const input = [{ type: 'text', text: content }];
    const params = busy ? {conversationId:target.nativeId,input,clientUserMessageId:messageId} : {
      conversationId: target.nativeId,
      turnStart: { request: { threadId: target.nativeId, input, clientUserMessageId: messageId }, context: { inheritThreadSettings: true } }
    };
    const response = await this.ipc.request(method, params, { version: busy ? 1 : 2, timeout: 20000, targetClientId: owner.handledByClientId });
    return { messageId, to: target.id, status: 'accepted', detail: 'Owning UI accepted request; not a completion acknowledgement', resultMethod: response.result?.method };
  }
  async sendClaude(target, content, messageId) {
    // Use only the peer credential, never the own-child token or a bypass-mode claim.
    const hash = createHash('sha256').update(target.endpoint.toLowerCase()).digest('hex');
    const file = path.join(this.home, '.claude', 'sessions', `${target.pid}.${hash}.key`);
    const stat = await fs.lstat(file); if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Unsafe peer credential file');
    const key = JSON.parse(await fs.readFile(file, 'utf8'));
    if (typeof key.peerToken !== 'string' || !/^[0-9a-f]{32}$/i.test(key.peerToken)) throw Error('Unsupported peer credential format');
    if (target.procStart && key.procStartFt && target.procStart !== key.procStartFt) throw Error('Claude process identity changed');
    return new Promise((resolve, reject) => {
      const socket = net.connect(target.endpoint); let sent = false;
      const timer = setTimeout(() => { socket.destroy(); reject(Error('Claude pipe timeout; delivery may be unknown')); }, 3000);
      socket.on('error', e => { clearTimeout(timer); reject(Error(`Claude pipe ${e.code || 'error'}${sent ? '; delivery unknown' : ''}`)); });
      socket.on('connect', () => {
        const auth = { type: 'auth', token: key.peerToken };
        const frame = { type: 'user', session_id: target.nativeId, uuid: messageId, msgV: 1, msg_id: messageId, from: 'session-mesh', message: { role: 'user', content } };
        socket.end(JSON.stringify(auth) + '\n' + JSON.stringify(frame) + '\n', () => { sent = true; clearTimeout(timer); resolve({ messageId, to: target.id, status: 'submitted', detail: 'Written to native peer inbox; receiver can hold/refuse it. No delivery acknowledgement.' }); });
      });
    });
  }
  close() { this.ipc.close(); }
}
module.exports = { NativeMesh, readClaude, resolveTarget, codexState, alive };

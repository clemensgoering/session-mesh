'use strict';
const net = require('node:net');
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');

// Experimental Codex desktop/IDE IPC, observed in 26.1021.22027.
// Join the existing router only. Never create a router or start/resume a thread.
class CodexIPC extends EventEmitter {
  constructor(endpoint = '\\\\.\\pipe\\codex-ipc') {
    super(); this.endpoint = endpoint; this.pending = new Map(); this.buffer = Buffer.alloc(0);
    this.clientId = 'initializing-client'; this.ready = false;
  }
  async connect() {
    if (this.ready) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.open().finally(() => { this.connecting = null; });
    return this.connecting;
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket = net.connect(this.endpoint);
      const timeout = setTimeout(() => { this.socket.destroy(); reject(Error('Codex IPC connect timeout')); }, 2000);
      this.socket.once('connect', () => { clearTimeout(timeout); resolve(); });
      this.socket.on('error', e => { clearTimeout(timeout); reject(e); });
      this.socket.on('data', data => this.receive(data));
      this.socket.on('close', () => {
        this.ready = false; this.buffer = Buffer.alloc(0);
        for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(Error('Codex IPC disconnected; delivery may be unknown')); }
        this.pending.clear(); this.emit('disconnect');
      });
    });
    const result = await this.request('initialize', { clientType: 'session-mesh' }, { version: 0, timeout: 3000 });
    this.clientId = result.result.clientId; this.ready = true;
  }
  write(message) {
    if (!this.socket?.writable) throw Error('Codex IPC offline');
    const body = Buffer.from(JSON.stringify(message)), header = Buffer.alloc(4);
    header.writeUInt32LE(body.length); this.socket.write(Buffer.concat([header, body]));
  }
  receive(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (this.buffer.length >= 4) {
      const size = this.buffer.readUInt32LE(0);
      if (!size || size > 64 * 1024 * 1024) { this.socket.destroy(); return; }
      if (this.buffer.length < size + 4) return;
      const body = this.buffer.subarray(4, size + 4); this.buffer = this.buffer.subarray(size + 4);
      let m; try { m = JSON.parse(body); } catch { this.socket.destroy(); return; }
      if (m.type === 'response') {
        const p = this.pending.get(m.requestId); if (!p) continue;
        clearTimeout(p.timer); this.pending.delete(m.requestId);
        if (m.resultType === 'error') p.reject(Error(m.error || 'IPC request rejected')); else p.resolve(m);
      } else if (m.type === 'client-discovery-request') {
        this.write({ type: 'client-discovery-response', requestId: m.requestId, response: { canHandle: false } });
      } else if (m.type === 'broadcast') this.emit('broadcast', m);
    }
  }
  request(method, params, { version = 1, timeout = 1800, targetClientId } = {}) {
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(Error(`${method}: timeout; delivery may be unknown`)); }, timeout);
      this.pending.set(requestId, { resolve, reject, timer });
      try { this.write({ type: 'request', requestId, sourceClientId: this.clientId, version, method, params, timeoutMs: timeout, targetClientId }); }
      catch (e) { clearTimeout(timer); this.pending.delete(requestId); reject(e); }
    });
  }
  broadcast(method, params, version, targetClientIds) {
    this.write({ type: 'broadcast', sourceClientId: this.clientId, method, params, version, targetClientIds });
  }
  async owner(id) {
    await this.connect();
    return this.request('thread-owner-discovery', { hostId: 'local', conversationId: id });
  }
  async snapshot(id, owner) {
    return new Promise((resolve) => {
      const done = value => { clearTimeout(timer); this.off('broadcast', onMessage); try { this.broadcast('thread-stream-following-changed', { hostId: 'local', conversationId: id, following: false }, 1, [owner]); } catch {} resolve(value); };
      const onMessage = m => { if (m.method === 'thread-stream-state-changed' && m.sourceClientId === owner && m.params?.conversationId === id && m.params.change?.type === 'snapshot') done(m.params.change.conversationState); };
      const timer = setTimeout(() => done(null), 1800); this.on('broadcast', onMessage);
      try { this.broadcast('thread-stream-following-changed', { hostId: 'local', conversationId: id, following: true }, 1, [owner]); } catch { done(null); }
    });
  }
  close() { this.socket?.destroy(); }
}
module.exports = { CodexIPC };

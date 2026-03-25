const net = require('net');
const { v4: uuidv4 } = (() => {
  try { return require('uuid'); } catch (_) { return { v4: () => Math.random().toString(36).slice(2) + Date.now().toString(36) }; }
})();

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };
let socket = null;
let ready = false;
let currentClientId = '';
let pendingActivity = null;

function encode(op, data) {
  const payload = JSON.stringify(data);
  const len = Buffer.byteLength(payload);
  const buf = Buffer.alloc(8 + len);
  buf.writeInt32LE(op, 0);
  buf.writeInt32LE(len, 4);
  buf.write(payload, 8);
  return buf;
}

function decode(buf) {
  if (buf.length < 8) return null;
  const op = buf.readInt32LE(0);
  const len = buf.readInt32LE(4);
  if (buf.length < 8 + len) return null;
  let data;
  try { data = JSON.parse(buf.slice(8, 8 + len).toString()); } catch (_) { data = {}; }
  return { op, data };
}

function getIPCPath(id) {
  if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${id}`;
  const prefix = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
  return `${prefix}/discord-ipc-${id}`;
}

async function tryConnect(clientId, pipeIndex) {
  return new Promise((resolve) => {
    const pipePath = getIPCPath(pipeIndex);
    const sock = net.createConnection(pipePath);
    let settled = false;
    let recvBuf = Buffer.alloc(0);

    const timer = setTimeout(() => {
      if (!settled) { settled = true; sock.destroy(); resolve(null); }
    }, 4000);

    sock.on('connect', () => {
      sock.write(encode(OP.HANDSHAKE, { v: 1, client_id: clientId }));
    });

    sock.on('data', (chunk) => {
      recvBuf = Buffer.concat([recvBuf, chunk]);
      const msg = decode(recvBuf);
      if (!msg) return;
      recvBuf = recvBuf.slice(8 + Buffer.byteLength(JSON.stringify(msg.data)));

      if (msg.op === OP.FRAME && msg.data.cmd === 'DISPATCH' && msg.data.evt === 'READY') {
        if (!settled) { settled = true; clearTimeout(timer); resolve(sock); }
      } else if (msg.op === OP.CLOSE) {
        if (!settled) { settled = true; clearTimeout(timer); sock.destroy(); resolve(null); }
      }
    });

    sock.on('error', () => {
      if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
    });
    sock.on('close', () => {
      if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
    });
  });
}

function sendFrame(cmd, args, nonce) {
  if (!socket || !ready) return false;
  try {
    socket.write(encode(OP.FRAME, { cmd, args, nonce: nonce || uuidv4() }));
    return true;
  } catch (_) { return false; }
}

async function init(clientId) {
  if (!clientId || typeof clientId !== 'string') return false;
  if (socket && ready && currentClientId === clientId) return true;
  shutdown();
  currentClientId = clientId;

  for (let i = 0; i < 10; i++) {
    const sock = await tryConnect(clientId, i);
    if (sock) {
      socket = sock;
      ready = true;
      sock.on('close', () => { ready = false; socket = null; });
      sock.on('error', () => { ready = false; });
      if (pendingActivity) {
        sendFrame('SET_ACTIVITY', { pid: process.pid, activity: pendingActivity });
        pendingActivity = null;
      }
      return true;
    }
  }
  return false;
}

function update(details, state, startTimestamp) {
  const activity = {
    details: details || 'Modding PAYDAY 3',
    state: state || 'No mods installed',
    timestamps: { start: startTimestamp || Math.floor(Date.now() / 1000) },
    instance: false,
  };
  if (!socket || !ready) { pendingActivity = activity; return false; }
  return sendFrame('SET_ACTIVITY', { pid: process.pid, activity });
}

function clear() {
  if (!socket || !ready) return false;
  return sendFrame('SET_ACTIVITY', { pid: process.pid, activity: null });
}

function shutdown() {
  if (socket && ready) {
    try { sendFrame('SET_ACTIVITY', { pid: process.pid, activity: null }); } catch (_) {}
    try { socket.write(encode(OP.CLOSE, {})); } catch (_) {}
  }
  if (socket) { try { socket.destroy(); } catch (_) {} }
  socket = null;
  ready = false;
  currentClientId = '';
  pendingActivity = null;
}

module.exports = { init, update, clear, shutdown };

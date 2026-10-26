/**
 * Server-Sent Events (SSE) Live Event Stream Service
 * Streams real-time pipeline status, audit events, and alert notifications to connected clients
 */

const clients = new Set();

/**
 * Handles incoming SSE connection
 */
function subscribe(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to OneCheck live event stream', time: new Date().toISOString() })}\n\n`);

  clients.add(res);

  // Heartbeat ping every 25 seconds
  const pingInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(pingInterval);
    clients.delete(res);
  });
}

/**
 * Broadcasts an event to all connected clients
 */
function broadcast(eventType, payload) {
  const data = JSON.stringify(payload);
  const message = `event: ${eventType}\ndata: ${data}\n\n`;

  for (const client of clients) {
    client.write(message);
  }
}

function getConnectedClientsCount() {
  return clients.size;
}

module.exports = {
  subscribe,
  broadcast,
  getConnectedClientsCount
};

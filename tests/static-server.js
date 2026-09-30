import {createReadStream, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain',
  '.wav': 'audio/wav',
};

export async function startTestServer() {
  const server = createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }

    let filePath = resolve(root, `.${pathname}`);
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if (statSync(filePath).isDirectory()) filePath = resolve(filePath, 'index.html');
      const size = statSync(filePath).size;
      const range = parseRange(request.headers.range, size);
      if (range === false) {
        response.writeHead(416, {'Accept-Ranges': 'bytes', 'Content-Range': `bytes */${size}`}).end();
        return;
      }

      const partial = range !== null;
      const start = partial ? range.start : 0;
      const end = partial ? range.end : size - 1;
      const headers = {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(Math.max(0, end - start + 1)),
        'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
      };
      if (partial) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      response.writeHead(partial ? 206 : 200, headers);
      if (request.method === 'HEAD') {
        response.end();
      } else if (size === 0) {
        response.end();
      } else {
        createReadStream(filePath, {start, end}).pipe(response);
      }
    } catch {
      response.writeHead(404).end();
    }
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClose, reject) => {
      server.close(error => error ? reject(error) : resolveClose());
    }),
  };
}

function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size === 0) return false;
  let start;
  let end;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return false;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Number(match[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
        || start < 0 || start >= size || end < start) return false;
    end = Math.min(end, size - 1);
  }
  return {start, end};
}

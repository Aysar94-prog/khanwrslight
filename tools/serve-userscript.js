/* Simple local static server used to live-test the userscript in the browser.
 * Usage: node tools/serve-userscript.js [port]
 * Serves the `userscript` folder over http://127.0.0.1:<port>/
 * (localhost is a secure context, so an https game page can load from it).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = parseInt(process.argv[2], 10) || 8731;
const root = path.resolve(__dirname, '..', 'userscript');

const types = {
	'.js': 'application/javascript; charset=utf-8',
	'.user.js': 'application/javascript; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.html': 'text/html; charset=utf-8'
};

http.createServer((req, res) => {
	const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
	const file = path.join(root, path.normalize(urlPath).replace(/^([/\\])+/, ''));
	if (!file.startsWith(root)) {
		res.writeHead(403).end('forbidden');
		return;
	}
	fs.readFile(file, (err, data) => {
		if (err) {
			res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
			return;
		}
		res.writeHead(200, {
			'content-type': types[path.extname(file)] || 'application/octet-stream',
			'access-control-allow-origin': '*',
			'cache-control': 'no-store'
		}).end(data);
	});
}).listen(port, '127.0.0.1', () => {
	console.log('serving ' + root + ' on http://127.0.0.1:' + port + '/');
});

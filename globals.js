global.toId = function toId (string) {
	return string?.toLowerCase?.().replace(/[^a-z0-9]/g, '') ?? '';
};

const config = require('./config.js');
global.config = config;

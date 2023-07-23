const { Client } = require('ps-client');
const dotenv = require('dotenv');

dotenv.config();
const { USERNAME: username, PASSWORD: password } = process.env;
const config = require('./config.js');

require('./globals.js');

const DB = require('./database.js');

const client = new Client({ username, password, rooms: ['botdevelopment'] });
client.connect();

client.on('message', message => {
	if (message.isIntro || message.author.name === client.status.username) return;
	if (!message.content.startsWith(config.prefix)) {
		if (message.type === 'chat') message.reply(`Hi, I'm ${username}! I'm a Bot that handles the WiFi room. For support, please contact a staff member.`);
		return;
	}
	const checkPerms = getCheckPerms(message);
	const args = message.content.substr(config.prefix.length).split(' ');
	const command = toID(args.shift());
	switch (command) {
		case 'pip': {

		}
	}
});


// You shouldn't need to touch the stuff below this

function getcheckPerms (message) {
	const rankMap = {
		'‽':  -2,
		'!':  -1,
		' ':   0,
		'^': 0.5,
		'+':   1,
		'§': 1.5,
		'*':   3,
		'%':   2,
		'@':   3,
		'&':   4,
		'#':   5,

		'⛵':  1
	};
	const aliases = {
		voice: '+',
		driver: '%',
		mod: '@',
		moderator: '@',
		bot: '*',
		owner: '#',
		ro: '#',
		admin: '&'
	};
	function getRank (rank) {
		if (aliases[rank]) rank = aliases[rank];
		return rankMap[rank] ?? 0;
	}
	return function checkPerms (rankString) {
		if (!rankString) throw new Error('Must pass a rank to checkPerms');
		rankString = rankString.toLowerCase().replace(/ /g, '');
		if (!rankString.match(/^(?:room|chat)/)) throw new Error('Rank must start with room/chat');
		// 'room' checks for roomauth, 'chat' uses the rank shown in chat
		const rank = rankString.replace(/^(?:room|chat)/, '');
		const level = rankString.match(/^(?:room|chat)/);
		const requiredRank = getRank(rank);
		const room = config.mainRoom; // You can use message.target.id if you want to use this elsewhere
		const actualRank = level === 'room' ? message.parent.rooms.get(config.mainRoom)
	}
}

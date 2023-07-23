const { Client } = require('ps-client');
const dotenv = require('dotenv');

dotenv.config();
const { BOT_USERNAME: username, BOT_PASSWORD: password } = process.env;
const config = require('./config.js');

require('./globals.js');

const DB = require('./database.js');

const client = new Client({ username, password, rooms: ['botdevelopment'], debug: true });
client.connect();

client.on('message', message => {
	if (message.isIntro || message.author.name === client.status.username) return;
	if (message.content === '%...%') console.log(message, message.author, message.target);
	if (!message.content.startsWith(config.prefix)) {
		if (message.type === 'pm' && message.author.name) message.reply(`Hi, I'm ${username}! I'm a Bot for the WiFi room. For support, please contact a staff member.`);
		return;
	}
	const checkPerms = getCheckPerms(message);
	const args = message.content.substr(config.prefix.length).split(' ');
	const command = toId(args.shift());
	try {
		switch (command) {
			// Make sure to run a checkPerms on everything!
			// Also would recommend using checkPerms('chatvoice') for broadcasting stuff
			// since it uses the displayed rank (higher of room and global rank)
			case 'pip': {
				checkPerms('roommod');
				message.reply('pip');
				break;
			}
			case 'lup': {
				checkPerms('globalvoice');
				message.reply('lup');
				break;
			}
		}
	} catch (err) {
		message.reply(err.message);
		if (err.name !== 'ChatError') console.log(err, err.name);
	}
});


// You shouldn't need to touch the stuff below this

class ChatError extends Error {
	constructor (args) {
		super(args);
		this.name = this.constructor.name;
	}
}

function getCheckPerms (message) {
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
	function aliasRank (rank) {
		if (aliases[rank]) return aliases[rank];
		else return rank;
	}
	function getRank (rank) {
		return rankMap[aliasRank(rank)] ?? 0;
	}
	return function checkPerms (rankString, throwErr = true) {
		if (!rankString) throw new Error('Must pass a rank to checkPerms');
		rankString = rankString.toLowerCase().replace(/ /g, '');
		const rankRegex = /^(?:room|chat|global)/;
		const level = rankString.match(rankRegex)?.toString();
		if (!level) throw new Error('Rank must start with room/chat');
		// 'room' checks for roomauth, 'chat' uses the rank shown in chat, 'global' uses the global rank
		const rank = rankString.replace(rankRegex, '');
		const requiredRank = getRank(rank);
		const room = config.mainRoom; // You can use message.target.roomid if you want to use this elsewhere
		const actualRank = getRank(
			level === 'room' ? Object.entries(message.parent.rooms.get(room)?.auth ?? {}).find(([sym, list]) => {
				return list.includes(message.author.userid);
			})?.[0] :
			level === 'chat' ? message.msgRank :
			level === 'global' ? message.author.group :
			null);
		if (actualRank >= requiredRank) return true;
		console.log(actualRank, requiredRank, level, message.msgRank, room, message.parent.rooms);
		if (throwErr) throw new ChatError('Insufficient permissions');
		return false;
	}
}

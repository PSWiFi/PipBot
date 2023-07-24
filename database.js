const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URL);

const pointsSchema = new mongoose.Schema({
	_id: { type: String, required: true },
	name: { type: String, required: true },
	room: { type: String, required: true, default: config.mainRoom },
	points: { type: [Number], required: true, default: [0] }
});

const Points = mongoose.model('points', pointsSchema);

async function getPoints (user, room = config.mainRoom) {
	return Points.findById(`${toId(room)}-${toId(user)}`).lean();
}

async function addPoints (user, room, amt, type = 0) {
	const res = await Points.findOneAndUpdate({ _id: `${toId(room)}-${toId(user)}` }, { $inc: { [`points.${type}`]: amt } }).lean();
	if (!res) {
		const pointsVal = Array.from({ length: type + 1 }, (_, i) => i === type ? amt : 0);
		const pointsDoc = new Points({ _id: `${toId(room)}-${toId(user)}`, name: user, room: toId(room), points: pointsVal })
		return pointsDoc.save();
	}
}

async function bulkAddPoints (users, room, amt, type = 0) {
	const ids = users.map(user => `${toId(room)}-${toId(user)}`);
	return Points.updateMany({ _id: { $in: ids } }, { $inc: { [`points.${type}`]: amt } });
}

async function setPoints (user, room, setTo = 0) {
	return Points.findOneAndUpdate({ _id: `${toId(room)}-${toId(user)}` }, { points: Array.isArray(setTo) ? setTo : [setTo] }, { new: true }).lean();
}

async function deletePoints (user, room = config.mainRoom) {
	return Points.deleteOne({ _id: `${toId(room)}-${toId(user)}` });
}

async function logPoints (room = config.mainRoom) {
	return Points.find({ room: toId(room) }).lean();
}

async function resetPoints (room = config.mainRoom, resetTo = [0]) {
	return Promise.all(resetTo.map((val, i) => {
		return Points.updateMany({ room: toId(room), `points.${i}`: { $gte: val } }, { `points.${i}`: val });
	}));
}

module.exports = {
	getPoints,
	addPoints,
	bulkAddPoints,
	setPoints,
	deletePoints,
	logPoints,
	resetPoints
};

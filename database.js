const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URL);

const pointsSchema = new mongoose.Schema({
	_id: { type: String, required: true },
	name: { type: String, required: true },
	room: { type: String, required: true, default: config.mainRoom },
	points: { type: [Number], required: true, default: [0] }
});

const Points = mongoose.model('points', pointsSchema);

async function getPoints (user, room) {
	return Points.findOneById(`${toId(room)}-${toId(user)}`);
}

async function addPoints (user, room, amt, type = 0) {
	return Points.findOneAndUpdate({ _id: `${toId(room)}-${toId(user)}` }, { $inc: { [`points.${type}`]: amt } })
}

async function setPoints (user, room, amt, setTo = 0) {
	return Points.findOneAndUpdate({ _id: `${toId(room)}-${toId(user)}` }, { points: Array.isArray(setTo) ? setTo : [setTo] });
}

async function deletePoints (user, room) {
	return Points.deleteOne({ _id: `${toId(room)}-${toId(user)}` });
}

async function logPoints (room) {
	return Points.find({ points: { $gte: 0 }, room: toId(room) }).lean();
}

async function resetPoints (room, resetTo = 0) {
	return Points.updateMany({ room: toId(room) }, { points: Array.isArray(resetTo) ? resetTo : [resetTo] });
}

module.exports = {
	getPoints,
	addPoints,
	setPoints,
	deletePoints,
	logPoints,
	resetPoints
};

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

async function addPoints (user, room, amt, type = 0, cap = 10_000) {
	// const $add = [{
	// 	$arrayElemAt: ['$points', type]
	// }, amt];
	// const res = await Points.aggregate([{ $match: { _id: `${toId(room)}-${toId(user)}` } }, { $addFields: {
	// 	[`points.${type}`]: { $cond: {
	// 		if: { $gt: [{ $add }, cap] },
	// 		then: cap,
	// 		else: { $add }
	// 	} }
	// } }]);
	// if (!res.length) {
	// 	const pointsVal = Array.from({ length: type + 1 }, (_, i) => i === type ? Math.min(cap, amt) : 0);
	// 	const pointsDoc = new Points({ _id: `${toId(room)}-${toId(user)}`, name: user, room: toId(room), points: pointsVal })
	// 	return pointsDoc.save();
	// }

	// Gah the good approach was tiring
	const entry = await Points.findById(`${toId(room)}-${toId(user)}`);
	console.log(entry);
	if (entry) {
		entry.points[type] ??= 0;
		entry.points[type] += amt;
		entry.points[type] = Math.min(entry.points[type], cap);
		return entry.save();
	} else {
		const pointsVal = Array.from({ length: type + 1 }, (_, i) => i === type ? Math.min(cap, amt) : 0);
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

async function resetPoints(room = config.mainRoom, resetTo = [15, 0]) {
	const cursor = Points.find({ room: toId(room) }).cursor();
	return cursor.eachAsync(async (entry) => {
		const [oldWP, oldHWP] = entry.points;
		const newWP = Math.max(0, Math.min(oldWP + (oldHWP || 0), resetTo[0]));
		entry.points = [newWP, resetTo[1]];
		await entry.save();
	});
}



const cacheSchema = new mongoose.Schema({
	id: { type: String, unique: true, required: true },
	value: String
});
const Cache = mongoose.model('cache', cacheSchema);

async function setTourDetails (val) {
	return Cache.findOneAndUpdate({ id: 'tourDetails' }, { $set: { value: val } }, { upsert: true, new: true });
}
async function getTourDetails () {
	const res = await Cache.findOne({ id: 'tourDetails' });
	return res || '';
}


module.exports = {
	getPoints,
	addPoints,
	bulkAddPoints,
	setPoints,
	deletePoints,
	logPoints,
	resetPoints,

	setTourDetails,
	getTourDetails
};

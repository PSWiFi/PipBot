const { Client } = require("ps-client");
const dotenv = require("dotenv");

dotenv.config();
const CACHE = {};
const { BOT_USERNAME: username, BOT_PASSWORD: password } = process.env;
const config = require("./config.js");

require("./globals.js");

const DB = require("./database.js");

const client = new Client({
  username,
  password,
  rooms: config.rooms,
  debug: true,
});
client.connect();

const FORMATTING_CHARS = ["*", "_", "`", "~", "^", "\\"];

const DEFAULT_MESSAGE = `Hi, I'm ${username}! I'm a Bot for the WiFi room - my prefix is \`\`${config.prefix}\`\`. For support, please contact a staff member.`;
const CANNOT_BE_USED_IN_PM = "This command can only be used in a room.";

client.on("message", async (message) => {
  if (message.isIntro || message.author.name === client.status.username) return;
  if (message.content === "%...%")
    console.log(message, message.author, message.target);

  if (!message.content.startsWith(config.prefix)) {
    if (message.type === "pm" && message.author.name)
      message.reply(DEFAULT_MESSAGE);
    return;
  }

  if (
    FORMATTING_CHARS.includes(config.prefix) &&
    message.content.startsWith(config.prefix.repeat(2))
  )
    return; // Don't try and interpret formatting as a command

  const checkPerms = getCheckPerms(message);
  const args = message.content.substr(config.prefix.length).split(" ");
  const command = args.shift().toLowerCase().trim();
  try {
    switch (command) {
      // Make sure to run a checkPerms on everything!
      // Also would recommend using checkPerms('chatvoice') for broadcasting stuff
      // since it uses the displayed rank (higher of room and global rank)
      // Also remember to add a break after every command
      // Yes I could've used modular functions but I'm lazy okay

      // We're using both addwp and addhwp as the same command; the line
      // with useHelperPoints is what makes them slightly different
      case "addwp":
      case "addhwp":
      case "addpp":
      case "removepp":
      case "removewp":
      case "removehwp":
        checkPerms("chatvoice");
        // Remove the next line if you want to let staff use this in DMs
        if (message.type !== "chat")
          throw new ChatError(CANNOT_BE_USED_IN_PM);
        const params = args
          .join(" ")
          .split(",")
          .map((param) => param.trim());
        let [amt, ...extra] = params.filter((param) => /^-?\d+$/.test(param));
        if (extra.length)
          throw new ChatError(
            `Please provide only 1 number (received: ${extra + 1})`
          );
        // You can also make this '1' or something instead!
        if (!amt || parseInt(amt) === 0)
          throw new ChatError("Please provide the number of points to add.");
        const users = params.filter((param) => /[a-z]/i.test(param));
        const useHelperPoints = command.includes("hwp");
        const remove = command.includes("remove") || amt < 0;
        if (remove) amt = Math.abs(amt) * -1;
        await Promise.all(
          users.map((user) =>
            DB.addPoints(
              user,
              config.mainRoom,
              parseInt(amt),
              useHelperPoints ? 1 : 0,
              useHelperPoints ? 150 : 10_000
            )
          )
        );
        // TODO: Probably make this a Promise.allSettled and display results instead
        // await DB.bulkAddPoints(users, config.mainRoom, parseInt(amt));
        message.reply(
          `${Math.abs(amt)} point${Math.abs(amt) === 1 ? "" : "s"} ${
            remove ? "removed from" : "awarded to"
          } ${users.join(", ")}.`
        );
        break;

      case "wp":
      case "viewwp":
        if (message.type === "chat") checkPerms("chatvoice");
        const user = args.length ? toId(args.join("")) : message.author.userid;
        try {
          const {
            name,
            points: [wp, hp = 0],
          } = await DB.getPoints(user);
          message.reply(
            `${name} has ${wp + hp} point${Math.abs(wp + hp) === 1 ? "" : "s"}${
              hp ? ` - ${wp}WP and ${hp}HWP` : ""
            }.`
          );
        } catch (err) {
          throw new ChatError("That user doesn't have any points...");
        }
        break;

      case "reset":
      case "resetwp":
        checkPerms("roomdriver"); // Maybe make this roommod? Perms are up to you
        // Remove the next line if you want to let staff use this in DMs
        if (message.type !== "chat")
          throw new ChatError(CANNOT_BE_USED_IN_PM);
        message.reply(
          "Are you sure you want to reset the leaderboard? Type 'confirm' to confirm within the next 10 seconds."
        );
        try {
          await message.target.waitFor((msg) => {
            return (
              msg.author.userid === message.author.userid &&
              toId(msg.content) === "confirm"
            );
          }, 10_000);
          message.reply("Resetting points, please wait...");
          await DB.resetPoints(config.mainRoom, [15, 0]);
          message.reply("Points have been reset!");
        } catch {
          message.reply("Time expired.");
        }
        break;

      case "monthly":
        if (message.type === "pm") {
          // Set the value of the monthly
          checkPerms("roomowner");
          const tourDetails = args.join(" ").trim();
          if (!tourDetails)
            throw new ChatError("Please provide a format for the tour.");
          CACHE.tourDetails = tourDetails;
          DB.setTourDetails(tourDetails);
          message.reply(`Set monthly tour to: ${tourDetails}`);
        } else if (message.type === "chat") {
          // Creating a monthly tour
          checkPerms("roomvoice");
          if (!CACHE.tourDetails) CACHE.tourDetails = await DB.getTourDetails();
          message.reply(`/tour create ${CACHE.tourDetails}, elimination`);
          message.reply("/tour autostart 5");
          message.reply("/tour autodq 2");
          message.reply("/tour scouting disallow");
        }
        break;

      default:
        throw new ChatError(DEFAULT_MESSAGE);
    }
  } catch (err) {
    message.reply(err.message);
    if (err.name !== "ChatError") console.log(err, err.name);
  }
});

// You shouldn't need to touch the stuff below this

function getCheckPerms(message) {
  const rankMap = {
    "‽": -2,
    "!": -1,
    " ": 0,
    "^": 0.5,
    "+": 1,
    "§": 1.5,
    "*": 3,
    "%": 2,
    "@": 3,
    "&": 4,
    "#": 5,

    "⛵": 1,
  };
  const aliases = {
    voice: "+",
    driver: "%",
    mod: "@",
    moderator: "@",
    bot: "*",
    owner: "#",
    ro: "#",
    admin: "&",
  };
  function aliasRank(rank) {
    if (aliases[rank]) return aliases[rank];
    else return rank;
  }
  function getRank(rank) {
    return rankMap[aliasRank(rank)] ?? 0;
  }
  return function checkPerms(rankString, throwErr = true) {
    if (!rankString) throw new Error("Must pass a rank to checkPerms");
    rankString = rankString.toLowerCase().replace(/ /g, "");
    const rankRegex = /^(?:room|chat|global)/;
    const level = rankString.match(rankRegex)?.toString();
    if (!level) throw new Error("Rank must start with room/chat");
    // 'room' checks for roomauth, 'chat' uses the rank shown in chat, 'global' uses the global rank
    const rank = rankString.replace(rankRegex, "");
    const requiredRank = getRank(rank);
    const room = config.mainRoom; // You can use message.target.roomid if you want to use this elsewhere
    const actualRank = getRank(
      level === "room"
        ? Object.entries(message.parent.rooms.get(room)?.auth ?? {}).find(
            ([sym, list]) => {
              return list.includes(message.author.userid);
            }
          )?.[0]
        : level === "chat"
        ? message.msgRank
        : level === "global"
        ? message.author.group
        : null
    );
    if (actualRank >= requiredRank) return true;
    if (throwErr) throw new ChatError("Insufficient permissions");
    return false;
  };
}

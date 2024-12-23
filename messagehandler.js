const dotenv = require("dotenv");

dotenv.config();

const { BOT_USERNAME: username } = process.env;

const FORMATTING_CHARS = ["*", "_", "`", "~", "^", "\\"];

const DEFAULT_MESSAGE = `Hi, I'm ${username}! I'm a Bot for the WiFi room - my prefix is \`\`${config.prefix}\`\`. For support, please contact a staff member.`;
const CANNOT_BE_USED_IN_PM = "This command can only be used in a room.";

async function handleMessage(message, client, DB) {
  if (message.author?.name) {
    if (message.isIntro || message.author?.name === client.status.username)
      return;
    if (message.content === "%...%")
      console.log(message, message.author, message.target);

    if (!message.content.startsWith(config.prefix)) {
      if (message.type === "pm" && message.author?.name)
        message.reply(DEFAULT_MESSAGE);
      return;
    }

    if (
      FORMATTING_CHARS.includes(config.prefix) &&
      message.content.startsWith(config.prefix.repeat(2))
    )
      return; // Don't try and interpret formatting as a command

    if (
      message.command === "/raw" &&
      message.content?.includes("</span> sent you a friend request!")
    )
      return;

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
        case "kill":
        case "restart": // Technically this command ends the process, but PipBot's VPS has a cron job set up to instantly restart the process
          checkPerms("roommod");
          process.exit(0);

        case "hangman":
          checkPerms("chatvoice");
          if (message.type !== "chat")
            throw new ChatError(CANNOT_BE_USED_IN_PM);
          message.reply("/hangman random");
          break;

        // We're using both addwp and addhwp as the same command; the line
        // with useHelperPoints is what makes them slightly different
        case "addwp":
        case "addhwp":
        case "addpp":
        case "addrizz":
        case "removepp":
        case "removewp":
        case "removehwp":
        case "removerizz":
          checkPerms("chatvoice");
          // Remove the next line if you want to let staff use this in DMs
          if (message.type !== "chat")
            throw new ChatError(CANNOT_BE_USED_IN_PM);
          let rizz = command.includes("rizz");
          const params = args
            .join(" ")
            .split(",")
            .map((param) => param.trim());
          let [amt, ...extra] = params.filter((param) => /^-?\d+$/.test(param));
          if (extra.length)
            throw new ChatError(
              `Please provide only 1 number (received: ${extra + 1})`
            );
          // You can also make this '1' or something instead
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
            `${Math.abs(amt)} ${rizz ? "rizz" : "point"}${
              Math.abs(amt) === 1 && !rizz ? "" : "s"
            } ${remove ? "removed from" : "awarded to"} ${users.join(", ")}.`
          );
          break;

        case "wp":
        case "viewwp":
        case "rizz":
        case "viewrizz":
          if (message.type === "chat") checkPerms("chatvoice");
          let rz = command.includes("rizz");
          const user = args.length
            ? toId(args.join(""))
            : message.author.userid;
          try {
            const {
              name,
              points: [wp, hp = 0],
            } = await DB.getPoints(user);
            if (rz) {
              message.reply(`${name} has ${wp + hp} rizz.`);
            } else {
              message.reply(
                `${name} has ${wp + hp} point${
                  Math.abs(wp + hp) === 1 ? "" : "s"
                }${hp ? ` - ${wp}WP and ${hp}HWP` : ""}.`
              );
            }
          } catch (err) {
            throw new ChatError(
              `That user doesn't have any ${rz ? "rizz" : "points"}...`
            );
          }
          break;

        case "reset":
        case "resetwp":
        case "fanumtax":
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
            let tmp = tourDetails.split(",");
            const format = tmp.shift();
            const rules = tmp.join(", ");
            CACHE.tourDetails = tourDetails;
            DB.setTourDetails(tourDetails);
            message.reply(
              `Set monthly tour to: \`\`${format}\`\`. Please ensure there are no typos in the format string or creating the tour will fail!`
            );
            if (rules?.length > 0) message.reply(`Added rules: ${rules}`);
          } else if (message.type === "chat") {
            // Creating a monthly tour
            checkPerms("roomvoice");
            if (!CACHE?.tourDetails?.value)
              CACHE.tourDetails = await DB.getTourDetails();
            if (!CACHE?.tourDetails?.value) break;

            let tmp = CACHE.tourDetails.value.split(",");
            const format = tmp.shift();
            const rules = tmp.join(", ");

            message.reply(
              `/modnote Attempting to create a ${format} tour. If it is unsuccessful, please verify the format is valid and get a Room Owner or higher to re-set it by using ${config.prefix}monthly FormatName in PMs with the bot.`
            );
            message.reply(`/tour create ${format}, elimination`);
            if (rules?.length > 0) message.reply(`/tour rules ${rules}`);
            message.reply("/tour autostart 5");
            message.reply("/tour autodq 2");
            message.reply("/tour scouting disallow");
          }
          break;

        case "say":
          if (!config.developers.includes(message.author.userid))
            checkPerms("roomowner");
          message.reply(args.join(" "));
          break;

        case "sayroom":
          if (!config.developers.includes(message.author.userid))
            throw new ChatError("You lack permission to use this command.");
          let room = toId(args.shift());
          if (!room || !args.length)
            throw new ChatError(
              `\`\`${config.prefix}sayroom room, message or command\`\``
            );
          client.send(`${room}|${args.join(" ").trim()}`);
          break;

        case "uptime":
          const time = Math.floor(process.uptime());

          let hours = Math.floor(time / 3600);
          const mins = Math.floor((time - hours * 3600) / 60);
          const secs = Math.floor(time - hours * 3600 - mins * 60);
          const days = Math.floor(time / (60 * 60 * 24));
          hours = hours % 24;

          let str;
          if (days > 0) {
            str = [
              `${days} day${days === 1 ? "" : "s"}`,
              `${hours} hour${hours === 1 ? "" : "s"}`,
              `${mins} minute${mins === 1 ? "" : "s"}`,
              `and ${secs} second${secs === 1 ? "" : "s"}`,
            ];
          } else if (hours > 0) {
            str = [
              `${hours} hour${hours === 1 ? "" : "s"}`,
              `${mins} minute${mins === 1 ? "" : "s"}`,
              `and ${secs} second${secs === 1 ? "" : "s"}`,
            ];
          } else if (mins > 0) {
            str = [
              `${mins} minute${mins === 1 ? "" : "s"} and ${secs} second${
                secs === 1 ? "" : "s"
              }`,
            ];
          } else {
            str = [`${secs} second${secs === 1 ? "" : "s"}`];
          }

          message.reply(`${username} uptime: ${str.join(", ")}`);
          break;

        case "rejoin":
        case "rj":
          for (const room of config.rooms) {
            client.send("|/j " + room);
          }
          break;

        default:
          throw new ChatError(DEFAULT_MESSAGE);
      }
    } catch (err) {
      message.reply(err.message);
      if (err.name !== "ChatError") console.log(err, err.name);
    }
  }
}

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
    "~": 4,
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
    admin: "~",
  };
  function aliasRank(rank) {
    if (aliases[rank]) return aliases[rank];
    else return rank;
  }
  function getRank(rank) {
    return rankMap[aliasRank(rank)] ?? 0;
  }
  return function checkPerms(rankString, throwErr = true) {
    if (config.developers.includes(message.author.id)) return true; // devs bypass permission checks
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

module.exports = {
  handleMessage,
};

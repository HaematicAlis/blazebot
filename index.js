const { Client, Intents, MessageEmbed } = require('discord.js');
const rankingsJson = require('./rankings.json');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS] });
require('dotenv').config();

const blazeBotId = '719675295006851072';
const channels = [
	//'929231150386409512', // #ranked (melee)
	'551698142840619017', // #bot-test (damp)
];
const rankings = Object.keys(rankingsJson).map((key) => rankingsJson[key]);
const embedColor = '#b265d8';
const cancelEmoji = '❌'; // x
const acceptEmoji = '✅'; // white_check_mark
const loseEmoji = '🥈'; // second_place
const winEmoji = '🏆'; // trophy

var games = [];
const DSR_DEFAULT = true;
const STAGE_LIST = [
	{ name: 'Final Destination' },
	{ name: 'Battlefield' },
	{ name: 'Yoshi\'s Story' },
	{ name: 'Dreamland 64' },
	{ name: 'Fountain of Dreams' },
	{ name: 'Pokemon Stadium' },
];

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
	// Check user
	if (message.member.id === blazeBotId) { return; }

	// Check channel
	if (!channels.includes(message.channel.id)) { return; }

	// TOP
	if (message.content.startsWith('-top')) {
		const page = message.content.slice(5);
		const leaderboardEmbed = new MessageEmbed()
			.setTitle('Leaderboard')
			.setColor(embedColor)
			.setDescription(buildLeaderboard(page));
		message.channel.send({ embeds: [leaderboardEmbed] });
	}
	// RANKED
	else if (message.content.startsWith('-ranked')) {
		const arg = message.content.slice(8); // bo3 or bo5
		
		const foundPlayer = rankings.find((player) => player.id === message.author.id);
		const player = foundPlayer
			? foundPlayer
			: { id: message.author.id, name: message.author.username, elo: 1500 };
		const bo = arg === 'bo5'
			? 5
			: 3;

		const rankedEmbed = new MessageEmbed()
			.setTitle(foundPlayer.name + ' [' + foundPlayer.elo + '] is searching for a match... (bo' + bo + ')')
			.setColor(embedColor)
			.setDescription(cancelEmoji + ' = Cancel search\n' + acceptEmoji + ' = Accept challenge');
		const gameMessage = await message.channel.send({ embeds: [rankedEmbed] });
		games.push({ messageId: gameMessage.id, players: [player], setType: bo, dsr: DSR_DEFAULT, game: 1, winner: -1, loser: -1, stageList: STAGE_LIST });
		await gameMessage.react(cancelEmoji);
		await gameMessage.react(acceptEmoji);
	}
	// RANK
	else if (message.content.startsWith('-rank')) {
		const arg = message.content.slice(6);
		const playerList = Object.keys(rankings);
		const sortedRankings = rankings.sort((a, b) => b.elo - a.elo);

		// Default standings
		const standing = arg
			? arg <= playerList.length && arg > 0
				? arg
				: playerList.length
			: sortedRankings.findIndex((player) => player.id === message.author.id) + 1;

		const player = sortedRankings[standing - 1];
		const playerId = player.id;
		const user = await client.users.fetch(playerId)
		
		const rankEmbed = new MessageEmbed()
			.setTitle('Rank ' + standing)
			.setColor(embedColor)
			.setThumbnail(user.avatarURL())
			.setDescription('```' + player.name + ' [' + player.elo + ']```');
		message.channel.send({ embeds: [rankEmbed] })
	}
});

client.on('messageReactionAdd', async (reaction, user) => {
	try {
		await reaction.fetch();
		const foundGame = games.find((game) => game.messageId === reaction.message.id);
		const gameIndex = games.findIndex((game) => game.messageId === reaction.message.id);

		switch (reaction.emoji.name) {
			case cancelEmoji:
				// Cancel search
				if (foundGame.players.length === 1 && foundGame.players[0].id === user.id) {
					reaction.message.delete();
				}
				// Cancel after starting
				else if (foundGame.players.length > 1) {
					const reactionUsers = await reaction.users.fetch();
					const checkReacts = reactionUsers.map((user) =>
						foundGame.players.find((player) => player.id === user.id)
							? user.id
							: null)
						.filter((react) => react !== null);

					if (checkReacts.length === foundGame.players.length) {
						reaction.message.delete();
					}
				}
				break;

			case acceptEmoji:
				if (foundGame && !foundGame.players.find((player) => player.id === user.id || user.id === client.user.id)) {
					const foundPlayer = rankings.find((player) => player.id === user.id);
					const player = foundPlayer
						? foundPlayer
						: { id: user.id, name: user.username, elo: 1500 };
					games = games.map((game) => game.messageId === reaction.message.id ? { ...game, players: [...game.players, player] } : game);
					const acceptedGameEmbed = new MessageEmbed()
						.setTitle('Game 1')
						.setColor(embedColor)
						.setDescription('?')
					reaction.message.edit({ embeds: [acceptedGameEmbed] });
					await reaction.message.reactions.removeAll();
					await reaction.message.react(loseEmoji);
					await reaction.message.react(winEmoji);
				}
				break;
			
			case winEmoji:
				const foundWinner = foundGame.players.find((player) => player.id == user.id);
				const winnerIndex = foundGame.players.findIndex((player) => player.id == user.id);

				const loserId = winnerIndex
					? foundGame.players[0].id
					: foundGame.players[1].id;

				const loseReact = reaction.message.reactions.cache.find((reaction) => reaction.emoji.name === loseEmoji);
				const loseReactionUsers = await loseReact.users.fetch();
				const loserReact = loseReactionUsers.find((user) => user.id === loserId);
				
				if (foundWinner && loserReact) {
					games[gameIndex] = { ...games[gameIndex], game: games[gameIndex].game + 1, winner: winnerIndex, loser: winnerIndex ? 0 : 1 };
					const wonGameEmbed = new MessageEmbed()
						.setTitle('Game ' + games[gameIndex].game)
						.setColor(embedColor)
						.setDescription('?')
					reaction.message.edit({ embeds: [wonGameEmbed] });
				}
				break;

			case loseEmoji:
				const foundLoser = foundGame.players.find((player) => player.id == user.id);
				const loserIndex = foundGame.players.findIndex((player) => player.id == user.id);

				const winnerId = loserIndex
					? foundGame.players[0].id
					: foundGame.players[1].id;

				const winReact = reaction.message.reactions.cache.find((reaction) => reaction.emoji.name === winEmoji);
				const winReactionUsers = await winReact.users.fetch();
				const winnerReact = winReactionUsers.find((user) => user.id === winnerId);
				
				if (foundLoser && winnerReact) {
					games[gameIndex] = { ...games[gameIndex], game: games[gameIndex].game + 1, winner: loserIndex ? 0 : 1, loser: loserIndex };
					const lostGameEmbed = new MessageEmbed()
						.setTitle('Game ' + games[gameIndex].game)
						.setColor(embedColor)
						.setDescription('?')
					reaction.message.edit({ embeds: [lostGameEmbed] });
				}
				break;

			default:
				break;
		}
	} catch (error) {
		console.error('Something went wrong when fetching the message.');
	}
});

const buildLeaderboard = (p) => {
	const sortedRankings = rankings.sort((a, b) => b.elo - a.elo);

	const playerList = Object.keys(rankings);
	var LBContent = "```\n";
	if (playerList.length === 0) { return LBContent + 'No players made it to the leaderboard yet...```'; }

	// Check page out of bounds
	const numPages = Math.floor(playerList.length / 10);
	if (isNaN(p) || p > numPages + 1) { return LBContent + 'Page out of bounds.```'; }

	// Default page is 1
	const page = p ? p : 1;

	// Number of players on page
	const n = page > numPages || numPages === 0
		? playerList.length % 10
		: 10;

	const startIndex = (page - 1) * 10;
	for (var i = 0; i < n; i++) {
		const playerId = playerList[startIndex + i];
		const playerName = sortedRankings[playerId].name;
		const elo = sortedRankings[playerId].elo;
		standing = startIndex + i + 1;
		LBContent += `${standing}) ${playerName} [${elo}]\n\n`;
	}

	return LBContent + '```';
};

client.login(process.env.BOT_TOKEN);

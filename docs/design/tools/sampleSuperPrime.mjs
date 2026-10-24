// Reads the Super Prime results (docs/design/sample_data/results/super_prime.md: one table
// per round, the winner in bold first) into the bracket the design draws: rounds of matches,
// each car in its bracket slot. The export lists the winner first, so a car's slot comes from
// where it came from: in a round's match m, slot A holds the winner of the previous round's
// match 2m − 1 and slot B the winner of match 2m; the third-place match takes the semifinals'
// losers. A result that does not fit the bracket stops the build rather than drawing a wrong
// tree. "WO" with no opponent is a bye (no slot B); "sem placar" is a win with no number;
// "2 x 1" is a best of 3 with each car's wins.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The export's section titles and the names the graphic shows.
const roundNames = [
  { title: /^32 avos/, name: '32 avos de final' },
  { title: /^16 avos/, name: '16 avos de final' },
  { title: /^Oitavas/, name: 'Oitavas de final' },
  { title: /^Quartas/, name: 'Quartas de final' },
  { title: /^Semifinais/, name: 'Semifinal', bestOf: 3 },
  { title: /^Final/, name: 'Final', bestOf: 3 },
  { title: /^Disputa de 3/, name: 'Disputa de 3º lugar', bestOf: 3, isThirdPlace: true },
];

const readCarNumber = (cell) => {
  const match = /(\d+)\s*-/.exec(cell);
  return match ? Number(match[1]) : undefined;
};

function readRoundTables(markdown) {
  const sections = markdown.split(/^## /m).slice(1);
  return sections.map((section) => {
    const [title, ...lines] = section.split('\n');
    const round = roundNames.find((candidate) => candidate.title.test(title.trim()));
    if (round === undefined) throw new Error(`Unknown Super Prime round: ${title}`);
    const rows = lines
      .filter(
        (line) => line.startsWith('|') && !/^\|\s*-/.test(line) && !/Vencedor|Campeão/.test(line),
      )
      .map((line) =>
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim()),
      );
    const results = rows.map((cells) => {
      const [winnerCell, loserCell, resultCell] = cells.length === 4 ? cells.slice(1) : cells;
      return {
        winner: readCarNumber(winnerCell),
        loser: readCarNumber(loserCell),
        result: resultCell,
      };
    });
    return { ...round, results };
  });
}

/** The bracket: its title and its rounds, first round first, the third-place match last. */
export function readSuperPrime(teams) {
  const markdown = readFileSync(resolve('docs/design/sample_data/results/super_prime.md'), 'utf8');
  const title = 'Super Prime';
  const tables = readRoundTables(markdown);
  const describeCar = (carNumber, wins) => {
    const team = teams.get(carNumber);
    if (team === undefined) throw new Error(`Super Prime car ${carNumber} is not in teams.csv.`);
    return {
      carNumber,
      teamName: team.teamName,
      teamShortName: team.teamShortName,
      schoolName: team.schoolName,
      timeText: '',
      wins,
    };
  };

  const rounds = [];
  tables.forEach((table, tableIndex) => {
    const previousRound = table.isThirdPlace
      ? rounds.find((round) => round.name === 'Semifinal')
      : rounds.at(-1);
    const matches = table.results.map((result, index) => {
      const scoreMatch = /^(\d+)\s*x\s*(\d+)$/.exec(result.result);
      const winnerWins = scoreMatch ? Number(scoreMatch[1]) : undefined;
      const loserWins = scoreMatch ? Number(scoreMatch[2]) : undefined;
      let slotA = result.winner;
      let slotB = result.loser;
      if (tableIndex > 0) {
        const sources = table.isThirdPlace
          ? previousRound.matches.map((match) => loserOf(match))
          : [previousRound.matches[index * 2], previousRound.matches[index * 2 + 1]].map(
              (match) => match.winnerCarNumber,
            );
        if (!sources.includes(result.winner) || !sources.includes(result.loser)) {
          throw new Error(
            `${table.name} ${index + 1}: ${result.winner} x ${result.loser} does not follow the bracket.`,
          );
        }
        [slotA, slotB] = sources;
      }
      const winsOf = (carNumber) => (carNumber === result.winner ? winnerWins : loserWins);
      const isBye = result.loser === undefined;
      return {
        matchId: `r${tableIndex + 1}-m${index + 1}`,
        ...(table.bestOf === undefined ? {} : { bestOf: table.bestOf }),
        ...(result.result === 'WO' ? { walkover: true } : {}),
        carA: describeCar(slotA, winsOf(slotA)),
        ...(isBye ? {} : { carB: describeCar(slotB, winsOf(slotB)) }),
        winnerCarNumber: result.winner,
      };
    });
    rounds.push({
      name: table.name,
      ...(table.isThirdPlace ? { isThirdPlace: true } : {}),
      matches,
    });
  });
  return { title, rounds };
}

function loserOf(match) {
  return match.carA.carNumber === match.winnerCarNumber
    ? match.carB.carNumber
    : match.carA.carNumber;
}

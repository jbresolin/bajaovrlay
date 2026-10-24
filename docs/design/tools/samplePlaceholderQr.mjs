// A placeholder QR code for the QR card's mock-up: the three finder patterns of a real code
// and a fixed pseudo-random fill from a tiny seeded generator, so the pattern never changes
// between runs. It does not scan; the real graphic makes its code from the address.

/** The code as rows of "1" (dark) and "0" (light), `size` modules a side. */
export function buildPlaceholderQrModules(size) {
  let seed = 20270320;
  const nextBit = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % 3 !== 0;
  };
  const finderRing = (row, column) =>
    row === 0 ||
    row === 6 ||
    column === 0 ||
    column === 6 ||
    (row >= 2 && row <= 4 && column >= 2 && column <= 4);
  const rows = [];
  for (let row = 0; row < size; row += 1) {
    let line = '';
    for (let column = 0; column < size; column += 1) {
      const inTopLeft = row < 7 && column < 7;
      const inTopRight = row < 7 && column >= size - 7;
      const inBottomLeft = row >= size - 7 && column < 7;
      if (inTopLeft || inTopRight || inBottomLeft) {
        const localRow = row < 7 ? row : row - (size - 7);
        const localColumn = column < 7 ? column : column - (size - 7);
        line += finderRing(localRow, localColumn) ? '1' : '0';
      } else {
        line += nextBit() ? '1' : '0';
      }
    }
    rows.push(line);
  }
  return rows;
}

// Counted as Windows Explorer counts (1 MB = 1024 × 1024 bytes): the operator compares this
// number with the free space Explorer shows for the USB stick, not with the box it came in.
const bytesInOneMegabyte = 1024 * 1024;
const megabytesInOneGigabyte = 1024;

// The smallest size written: a new database is a few dozen kilobytes, and "0 MB" would
// read as an empty copy.
const smallestMegabytesWritten = 0.1;

const withOneDecimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const withNoDecimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/**
 * A backup's size as the operator reads it, in pt-BR: "0,1 MB" at least, one decimal
 * below 10 MB ("3,5 MB"), whole megabytes up to 1 GB ("48 MB"), then "2,3 GB".
 */
export function formatBackupSize(sizeInBytes: number): string {
  const sizeInMegabytes = Math.max(sizeInBytes / bytesInOneMegabyte, smallestMegabytesWritten);
  if (sizeInMegabytes >= megabytesInOneGigabyte) {
    const sizeInGigabytes = sizeInMegabytes / megabytesInOneGigabyte;
    return `${withOneDecimal.format(sizeInGigabytes)} GB`;
  }
  if (sizeInMegabytes < 10) {
    return `${withOneDecimal.format(sizeInMegabytes)} MB`;
  }
  return `${withNoDecimal.format(sizeInMegabytes)} MB`;
}

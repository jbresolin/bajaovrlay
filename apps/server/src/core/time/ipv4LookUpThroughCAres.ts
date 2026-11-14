import { Resolver } from 'node:dns/promises';
import type { LookupFunction } from 'node:net';

/** Looks up a host name's IPv4 addresses; rejects when it cannot. */
export type LookUpIpv4Addresses = (hostName: string) => Promise<string[]>;

/**
 * DNS through c-ares, not the system's getaddrinfo: with the uplink down at the track,
 * getaddrinfo holds one of Node's four thread-pool threads for 5 to 30 s per name and
 * cannot be cancelled, and the server's file reads wait behind it. One second and two
 * tries, then the look-up fails. Shared by the NTP polls and the HTTPS Date requests.
 * What could go wrong: c-ares does not read /etc/hosts, so a name only that file knows
 * is not found; give the server's IPv4 address instead.
 */
const resolverOfTheTimeServers = new Resolver({ timeout: 1_000, tries: 2 });

/** The default look-up of the time servers: a name's IPv4 addresses through c-ares. */
export function lookUpIpv4AddressesThroughDns(hostName: string): Promise<string[]> {
  return resolverOfTheTimeServers.resolve4(hostName);
}

/**
 * Turns a look-up into the `lookup` option of node:http and node:https, so their requests
 * resolve a name through it instead of getaddrinfo. Node asks for one address, or for all
 * of them (`all: true`, when it tries several in turn); both get IPv4 addresses only.
 */
export function buildLookupOptionForNodeRequests(
  lookUpIpv4Addresses: LookUpIpv4Addresses,
): LookupFunction {
  return (hostName, lookupOptions, callback) => {
    lookUpIpv4Addresses(hostName).then(
      (addresses) => {
        const firstAddress = addresses[0];
        if (firstAddress === undefined) {
          const noAddressError: NodeJS.ErrnoException = new Error(
            `no IPv4 address for ${hostName}`,
          );
          noAddressError.code = 'ENODATA';
          callback(noAddressError, '', 4);
          return;
        }
        if (lookupOptions.all === true) {
          const everyAddress = addresses.map((address) => ({ address, family: 4 }));
          callback(null, everyAddress);
          return;
        }
        callback(null, firstAddress, 4);
      },
      (lookUpError: NodeJS.ErrnoException) => {
        callback(lookUpError, '', 4);
      },
    );
  };
}

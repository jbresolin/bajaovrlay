/**
 * Reading BAJAOVRLAY_PUBLIC_ORIGINS and the image's defaults at boot (apps/server)
 *
 * What this module is for:
 *   readServerEnvironment checks every variable the server reads at boot and stops the
 *   boot naming a bad one. BAJAOVRLAY_PUBLIC_ORIGINS (the addresses of a reverse proxy
 *   whose pages may upload images) is read here into its list, so a typo stops the boot
 *   instead of refusing every upload. The Docker image sets the other variables itself
 *   (port 8080, every interface, everything under /data); they are read like any other.
 *
 * What these tests prove:
 *   - Unset, BAJAOVRLAY_PUBLIC_ORIGINS reads as an empty list.
 *   - Set, it reads as the list of its origins.
 *   - An entry that is not an origin stops the boot, naming the variable and the entry.
 *   - The values the Docker image sets are read as given.
 *
 * What these tests deliberately do not cover:
 *   - Every way an entry is read: publicOrigins.test.ts in the media module.
 *   - The Dockerfile itself: scripts/dockerSmoke.sh boots the image.
 */
import { describe, expect, it } from 'vitest';

import { readServerEnvironment } from './readServerEnvironment.js';

describe('readServerEnvironment and BAJAOVRLAY_PUBLIC_ORIGINS', () => {
  it('reads an unset variable as no public origin', () => {
    // Arrange: an environment without the variable, as the stream PC has it.
    const environmentVariables = {};

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: an empty list.
    expect(environment.BAJAOVRLAY_PUBLIC_ORIGINS, 'unset must mean no public origin').toEqual([]);
  });

  it("reads the proxy's address", () => {
    // Arrange: the TrueNAS install, behind Nginx Proxy Manager.
    const environmentVariables = { BAJAOVRLAY_PUBLIC_ORIGINS: 'https://bajaovrlay.casa.lan' };

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: the one origin.
    expect(environment.BAJAOVRLAY_PUBLIC_ORIGINS, "the list must hold the proxy's address").toEqual(
      ['https://bajaovrlay.casa.lan'],
    );
  });

  it('stops the boot naming the variable and an entry that is not an origin', () => {
    // Arrange: the host alone, written as in BAJAOVRLAY_SOURCE_ALLOWED_HOSTS by mistake.
    const environmentVariables = { BAJAOVRLAY_PUBLIC_ORIGINS: 'bajaovrlay.casa.lan' };

    // Act: read the environment, keeping what it throws.
    const readingTheEnvironment = () => readServerEnvironment(environmentVariables);

    // Assert: it throws, naming the variable and the entry as written.
    expect(readingTheEnvironment, 'the boot must stop naming the variable').toThrow(
      'BAJAOVRLAY_PUBLIC_ORIGINS',
    );
    expect(readingTheEnvironment, 'the boot must stop naming the bad entry').toThrow(
      '"bajaovrlay.casa.lan" is not an address like https://bajaovrlay.casa.lan',
    );
  });
});

describe("readServerEnvironment and the Docker image's defaults", () => {
  it('reads the port, the interface and the /data paths the image sets', () => {
    // Arrange: the variables the Dockerfile sets with ENV.
    const environmentVariables = {
      PORT: '8080',
      HOST: '0.0.0.0',
      DATABASE_PATH: '/data/bajaovrlay.sqlite',
      DATA_DIR: '/data',
    };

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: each value as the image set it, so a backup of /data is the whole install.
    expect(environment.PORT, 'the image listens on 8080').toBe(8080);
    expect(environment.HOST, 'the image listens on every interface').toBe('0.0.0.0');
    expect(environment.DATABASE_PATH, 'the database lives in /data').toBe(
      '/data/bajaovrlay.sqlite',
    );
    expect(environment.DATA_DIR, 'recordings and media live in /data').toBe('/data');
  });
});

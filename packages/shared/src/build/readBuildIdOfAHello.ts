// Reading the server's build from a hello before the page's own schema has looked at the
// rest of it (finding on gate 2 of PR #17). A page from an older build may refuse the
// new server's hello (its schemas do not know a new field or a new kind), and that page
// is exactly the one that must reload. So the build is read from the raw JSON with a
// schema of two fields: Zod leaves every other field unchecked, whatever it holds.
import { z } from 'zod';

const BuildIdOfAHelloSchema = z.object({
  type: z.literal('hello'),
  buildId: z.string().min(1),
});

/**
 * The `buildId` of a hello, read whatever its slices hold; undefined for any other
 * message, a hello naming no build, or anything that is not a JSON object.
 */
export function readBuildIdOfAHello(messageJson: unknown): string | undefined {
  const parsedHello = BuildIdOfAHelloSchema.safeParse(messageJson);
  if (!parsedHello.success) {
    return undefined;
  }
  return parsedHello.data.buildId;
}

import {z} from 'zod';
import {NetworkError} from './network-model';
import {parseUniqueJson} from './unique-json';

const maintainerIds = z.array(z.string().min(1).max(256).regex(/^[^\u0000-\u001f\u007f]+$/)).max(16);

/** Explicit human coordination permission; agent sponsorship and other review roles confer none. */
export function contributionMaintainerAllowed(userId: string, configuration: unknown) {
  if (configuration === undefined || configuration === null || configuration === '') return false;
  try {
    if (typeof configuration !== 'string') throw Error();
    const ids = maintainerIds.parse(parseUniqueJson(configuration, 4096, 2));
    if (new Set(ids).size !== ids.length) throw Error();
    return ids.includes(userId);
  } catch {
    throw new NetworkError('Contribution maintainer configuration unavailable.', 503);
  }
}

import { BSON, ObjectId } from 'mongodb';

const { EJSON } = BSON;

/**
 * Parse an ObjectId from a hex string.
 */
export function parseObjectId(input: string): ObjectId {
  if (/^[\da-f]{24}$/i.test(input)) {
    return new ObjectId(input);
  }
  throw new Error(`Invalid ObjectId: ${input}`);
}

/**
 * Convert a document to Extended JSON string.
 */
export function toJsonString(doc: Record<string, unknown>): string {
  return EJSON.stringify(EJSON.serialize(doc));
}

/**
 * Parse Extended JSON string back to a document.
 */
export function fromJsonString(json: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- EJSON.parse returns SerializableTypes (typed as any)
  return EJSON.deserialize(EJSON.parse(json));
}

/**
 * Safely attempt to parse a value, returning null on failure.
 */
export function toSafeBSON(input: string): unknown {
  try {
    return EJSON.parse(input);
  } catch {
    return null;
  }
}

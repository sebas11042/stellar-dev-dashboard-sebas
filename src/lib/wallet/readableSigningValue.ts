import { Address, Asset, scValToNative, xdr } from '@stellar/stellar-sdk';
import { SIGNING_LIMITS, type ReadableValue } from './signingPayloadTypes';

export function signingBytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Expose controls and bidi overrides instead of letting them disguise text. */
export function visibleText(text: string): string {
  return text.replace(
    /[\p{Cc}\u061c\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/gu,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

export function readableLabel(name: string): string {
  return visibleText(
    name
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .trim()
  );
}

/** Keep amounts/integers exact. Never silently truncate an unsupported value. */
export function readableValue(input: unknown): ReadableValue {
  let nodes = 0;
  const ancestors = new Set<object>();
  function visit(value: unknown, depth: number): ReadableValue {
    if (++nodes > SIGNING_LIMITS.nodes || depth > SIGNING_LIMITS.depth) {
      throw new Error('Signing details exceed the safe review limit.');
    }
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return visibleText(value);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value)) throw new Error('Unsafe numeric signing detail.');
      return String(value);
    }
    if (typeof value !== 'object') throw new Error('Unsupported signing detail.');
    if (ancestors.has(value)) throw new Error('Cyclic signing detail.');
    ancestors.add(value);
    try {
      if (value instanceof Asset) {
        return value.isNative()
          ? { asset: 'XLM' }
          : { asset: value.getCode(), issuer: value.getIssuer() };
      }
      if (value instanceof Uint8Array) {
        return { encoding: 'hex', bytes: signingBytesToHex(value) };
      }
      if (Array.isArray(value)) return value.map((item) => visit(item, depth + 1));
      if (value instanceof Map) {
        return [...value].map(([key, entry]) => ({
          key: visit(key, depth + 1),
          value: visit(entry, depth + 1),
        }));
      }
      if (value instanceof Date) return value.toISOString();
      const record = value as Record<string, unknown>;
      // SDK 17 uses discriminated XDR objects. Retain the discriminant and all
      // fields for other XDR structures, including nested authorization trees.
      if (typeof record.type === 'string' && record.type.startsWith('scAddressType')) {
        return Address.fromScAddress(value as xdr.ScAddress).toString();
      }
      if (
        typeof record.type === 'string' &&
        /^scv(?:[UI](?:32|64|128|256)|Timepoint|Duration)$/.test(record.type)
      ) {
        return { type: record.type, value: visit(scValToNative(value as xdr.ScVal), depth + 1) };
      }
      if (value instanceof xdr.XdrString && record.bytes instanceof Uint8Array) {
        return visibleText(new TextDecoder('utf-8', { fatal: true }).decode(record.bytes));
      }
      const entries = Object.entries(record);
      if (entries.length === 0) throw new Error('Unsupported empty signing detail.');
      const output: { [key: string]: ReadableValue } = Object.create(null);
      for (const [key, entry] of entries) output[readableLabel(key)] = visit(entry, depth + 1);
      return output;
    } finally {
      ancestors.delete(value);
    }
  }
  return visit(input, 0);
}

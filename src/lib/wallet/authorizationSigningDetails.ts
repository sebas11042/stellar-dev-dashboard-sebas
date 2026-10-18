import { xdr } from '@stellar/stellar-sdk';
import { readableValue } from './readableSigningValue';

export function authorizationSigningDetails(payload: string) {
  const entry = xdr.SorobanAuthorizationEntry.fromXDR(payload, 'base64');
  return {
    title: 'Review Soroban authorization',
    fields: {
      credentials: readableValue(entry.credentials),
      'authorized invocation tree': readableValue(entry.rootInvocation),
    },
  };
}

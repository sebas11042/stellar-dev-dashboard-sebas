import { FeeBumpTransaction, TransactionBuilder, type Transaction } from '@stellar/stellar-sdk';
import { readableValue } from './readableSigningValue';
import type { ReadableValue } from './signingPayloadTypes';

function innerDetails(transaction: Transaction): { [key: string]: ReadableValue } {
  return {
    source: transaction.source,
    sequence: transaction.sequence,
    'fee (stroops)': transaction.fee,
    memo: readableValue(transaction.memo),
    operations: transaction.operations.map((operation, index) => ({
      number: String(index + 1),
      ...readableValue(operation) as { [key: string]: ReadableValue },
    })),
    // Include every envelope field, not only a selected payment preview. This
    // also preserves preconditions, Soroban resources, auth and extension data.
    'complete envelope': readableValue(transaction.toEnvelope()),
  };
}

export function transactionSigningDetails(payload: string, passphrase: string) {
  const transaction = TransactionBuilder.fromXDR(payload, passphrase);
  if (transaction instanceof FeeBumpTransaction) {
    return {
      title: 'Review fee-bump transaction',
      fields: {
        'fee payer': transaction.feeSource,
        'maximum fee (stroops)': transaction.fee,
        'inner transaction': innerDetails(transaction.innerTransaction),
        'complete envelope': readableValue(transaction.toEnvelope()),
      },
    };
  }
  return { title: 'Review transaction', fields: innerDetails(transaction) };
}

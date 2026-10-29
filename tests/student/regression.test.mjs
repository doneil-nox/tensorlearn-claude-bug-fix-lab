import test from 'node:test';
import assert from 'node:assert/strict';
import { getClaim } from '../../src/claims.mjs';

const claimA = { id: 'claim-A', ownerId: 'user-4', status: 'open' };
const claimB = { id: 'claim-B', ownerId: 'user-42', status: 'approved' };
const makeRecords = () => [claimA, claimB];

test('add a regression reproducing the incident', () => {
  const records = makeRecords();
  assert.equal(getClaim(records, 'user-4', 'claim-B'), null);
  assert.equal(getClaim(records, 'user-42', 'claim-B'), claimB);
});

test('trims surrounding whitespace on all IDs', () => {
  assert.equal(getClaim(makeRecords(), ' user-42 ', '\tclaim-B\n'), claimB);
  assert.equal(getClaim([{ id: ' claim-C ', ownerId: ' user-9\n', status: 'open' }], 'user-9', 'claim-C')?.status, 'open');
});

test('preserves case and leading zeroes', () => {
  const records = makeRecords();
  assert.equal(getClaim(records, 'USER-42', 'claim-B'), null);
  assert.equal(getClaim(records, 'user-42', 'CLAIM-b'), null);
  const zero = { id: '007', ownerId: '0042', status: 'open' };
  assert.equal(getClaim([zero], '0042', '007'), zero);
  assert.equal(getClaim([zero], '42', '007'), null);
  assert.equal(getClaim([zero], '0042', '7'), null);
});

test('does not coerce non-string IDs', () => {
  const records = [{ id: 'claim-N', ownerId: '42', status: 'open' }, claimB];
  for (const bad of [42, null, undefined, {}, true, false]) {
    assert.equal(getClaim(records, bad, 'claim-B'), null);
    assert.equal(getClaim(records, 'user-42', bad), null);
  }
  assert.equal(getClaim(records, 42, 'claim-N'), null);
});

test('empty and whitespace-only IDs never match', () => {
  const records = [{ id: '', ownerId: '', status: 'open' }, claimB];
  assert.equal(getClaim(records, '', ''), null);
  assert.equal(getClaim(records, '   ', '   '), null);
  assert.equal(getClaim(records, '', 'claim-B'), null);
  assert.equal(getClaim(records, 'user-42', ''), null);
});

test('records with malformed id or ownerId cannot match', () => {
  const records = [
    { id: 1, ownerId: 'user-1', status: 'open' },
    { id: 'claim-X', ownerId: null, status: 'open' },
    { id: 'claim-Y', ownerId: 7, status: 'open' },
    { id: '   ', ownerId: 'user-1', status: 'open' },
  ];
  assert.equal(getClaim(records, 'user-1', 1), null);
  assert.equal(getClaim(records, 'user-1', '1'), null);
  assert.equal(getClaim(records, null, 'claim-X'), null);
  assert.equal(getClaim(records, '7', 'claim-Y'), null);
  assert.equal(getClaim(records, 'user-1', '   '), null);
});

test('returns null for unknown claims and non-array records', () => {
  assert.equal(getClaim(makeRecords(), 'user-42', 'claim-Z'), null);
  for (const bad of [null, undefined, {}, 'claim-B', 42]) {
    assert.equal(getClaim(bad, 'user-42', 'claim-B'), null);
  }
});

test('owners with overlapping identifiers each get only their own claims', () => {
  const records = [
    { id: 'c1', ownerId: 'user-4', status: 'open' },
    { id: 'c2', ownerId: 'user-42', status: 'open' },
    { id: 'c3', ownerId: 'user-421', status: 'open' },
  ];
  assert.equal(getClaim(records, 'user-4', 'c1'), records[0]);
  assert.equal(getClaim(records, 'user-4', 'c2'), null);
  assert.equal(getClaim(records, 'user-4', 'c3'), null);
  assert.equal(getClaim(records, 'user-42', 'c2'), records[1]);
  assert.equal(getClaim(records, 'user-42', 'c3'), null);
  assert.equal(getClaim(records, 'user-421', 'c3'), records[2]);
});

test('does not mutate the input list or records', () => {
  const records = [
    { id: ' claim-A ', ownerId: ' user-4 ', status: 'open' },
    { id: 'claim-B', ownerId: 'user-42', status: 'approved' },
  ];
  const snapshot = structuredClone(records);
  for (const r of records) Object.freeze(r);
  Object.freeze(records);
  assert.equal(getClaim(records, 'user-4', 'claim-A'), records[0]);
  assert.equal(getClaim(records, 'user-4', 'claim-B'), null);
  assert.deepEqual(records, snapshot);
});

import {
  tripKeys,
  expenseKeys,
  eventKeys,
  documentKeys,
  userKeys,
  invitationKeys,
  friendKeys,
} from '../queryKeys';

describe('tripKeys', () => {
  it('lists() returns a stable tuple', () => {
    expect(tripKeys.lists()).toEqual(['trips', 'list']);
  });

  it('detail(id) embeds the id', () => {
    expect(tripKeys.detail('trip-1')).toEqual(['trips', 'detail', 'trip-1']);
  });

  it('different ids produce different detail keys', () => {
    expect(tripKeys.detail('a')).not.toEqual(tripKeys.detail('b'));
  });
});

describe('expenseKeys', () => {
  it('list(tripId) scopes under the trip', () => {
    expect(expenseKeys.list('t1')).toEqual(['trips', 't1', 'expenses']);
  });

  it('detail(tripId, id) includes both ids', () => {
    expect(expenseKeys.detail('t1', 'e9')).toEqual(['trips', 't1', 'expenses', 'e9']);
  });

  it('balances(tripId) returns correct key', () => {
    expect(expenseKeys.balances('t1')).toEqual(['trips', 't1', 'balances']);
  });

  it('settlements(tripId) returns correct key', () => {
    expect(expenseKeys.settlements('t1')).toEqual(['trips', 't1', 'settlements']);
  });
});

describe('eventKeys', () => {
  it('list(tripId) returns correct key', () => {
    expect(eventKeys.list('t1')).toEqual(['trips', 't1', 'events']);
  });
});

describe('documentKeys', () => {
  it('list(tripId) returns correct key', () => {
    expect(documentKeys.list('t1')).toEqual(['trips', 't1', 'documents']);
  });

  it('byDate includes date and tzOffset', () => {
    expect(documentKeys.byDate('t1', '2024-03-15', -60)).toEqual([
      'trips', 't1', 'documents', 'by-date', '2024-03-15', -60,
    ]);
  });

  it('downloadUrl includes docId', () => {
    expect(documentKeys.downloadUrl('t1', 'doc-42')).toEqual([
      'trips', 't1', 'documents', 'doc-42', 'url',
    ]);
  });
});

describe('userKeys', () => {
  it('me() is stable', () => {
    expect(userKeys.me()).toEqual(['users', 'me']);
    expect(userKeys.me()).toEqual(userKeys.me());
  });

  it('avatar(userId) embeds userId', () => {
    expect(userKeys.avatar('u1')).toEqual(['users', 'u1', 'avatar']);
  });
});

describe('friendKeys', () => {
  it('list() returns correct key', () => {
    expect(friendKeys.list()).toEqual(['friends']);
  });

  it('requests() returns correct key', () => {
    expect(friendKeys.requests()).toEqual(['friends', 'requests']);
  });
});

describe('invitationKeys', () => {
  it('list() returns correct key', () => {
    expect(invitationKeys.list()).toEqual(['invitations']);
  });
});

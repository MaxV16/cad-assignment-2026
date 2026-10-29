import {
  actorKey,
  isMovieItem,
  isRoleItem,
  movieKey,
  parseId,
  toActor,
  toRole,
} from '../lambdas/shared/model';

describe('keys', () => {
  test('movie and actor keys', () => {
    expect(movieKey(1234)).toBe('m#1234');
    expect(actorKey(4321)).toBe('a#4321');
  });
});

describe('parseId', () => {
  test.each(['1', '1234', '9007199254740991'])('%s is a valid id', (value) => {
    expect(parseId(value)).toBe(Number(value));
  });

  test.each([undefined, '', '0', '-1', '01', '1.5', 'abc', ' 1', '1e3'])(
    '%s is not',
    (value) => {
      expect(parseId(value)).toBeUndefined();
    },
  );
});

describe('item type guards', () => {
  test('movie items', () => {
    expect(isMovieItem({ PK: 'm#1234', SK: 'm#1234' })).toBe(true);
    expect(isMovieItem({ PK: 'm#1234', SK: 'a#4321' })).toBe(false);
  });

  test('role items', () => {
    expect(isRoleItem({ PK: 'm#1234', SK: 'a#4321' })).toBe(true);
    expect(isRoleItem({ PK: 'm#1234', SK: 'm#1234' })).toBe(false);
    expect(isRoleItem({ PK: 'a#4321', SK: 'a#4321' })).toBe(false);
  });
});

describe('mappers', () => {
  test('toRole drops the key attributes', () => {
    const role = toRole({
      PK: 'm#1234',
      SK: 'a#4321',
      movieId: 1234,
      actorId: 4321,
      roleName: 'Ellis Boyd "Red" Redding',
      roleDescription: 'Narrator and deuteragonist.',
    });

    expect(role).toEqual({
      movieId: 1234,
      actorId: 4321,
      roleName: 'Ellis Boyd "Red" Redding',
      roleDescription: 'Narrator and deuteragonist.',
    });
  });

  test('toActor drops the key attributes', () => {
    const actor = toActor({
      PK: 'a#4321',
      SK: 'a#4321',
      actorId: 4321,
      name: 'Morgan Freeman',
      dateOfBirth: '01-06-1937',
      bio: 'American actor.',
    });

    expect(actor).toEqual({
      actorId: 4321,
      name: 'Morgan Freeman',
      dateOfBirth: '01-06-1937',
      bio: 'American actor.',
    });
  });
});

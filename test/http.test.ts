import type { APIGatewayProxyEvent } from 'aws-lambda';
import { isResponse, parseJsonObject, response } from '../lambdas/shared/http';

const eventWithBody = (body: string | null): APIGatewayProxyEvent =>
  ({ body } as APIGatewayProxyEvent);

test('response produces json with a content-type header', () => {
  const result = response(200, { data: [] });

  expect(result.statusCode).toBe(200);
  expect(result.headers?.['content-type']).toBe('application/json');
  expect(JSON.parse(result.body)).toEqual({ data: [] });
});

test('response keeps extra headers', () => {
  const result = response(201, {}, { location: '/movies/roles' });

  expect(result.headers?.location).toBe('/movies/roles');
});

test('isResponse tells responses apart from bodies', () => {
  expect(isResponse(response(400, {}))).toBe(true);
  expect(isResponse({ message: 'nope' })).toBe(false);
});

test('parseJsonObject reads an object body', () => {
  expect(parseJsonObject(eventWithBody('{"a":1}'))).toEqual({ a: 1 });
});

test('parseJsonObject treats a missing body as empty', () => {
  expect(parseJsonObject(eventWithBody(null))).toEqual({});
});

test.each(['not json', '[]', '"text"', 'null'])(
  'parseJsonObject rejects %s',
  (body) => {
    const result = parseJsonObject(eventWithBody(body));

    expect(isResponse(result)).toBe(true);
    if (isResponse(result)) expect(result.statusCode).toBe(400);
  },
);

import type { APIGatewayProxyEvent } from "aws-lambda";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { ddb } from "../lambdas/shared/db";
import { handler } from "../lambdas/app/add-movie-role";

const send = jest.spyOn(ddb, "send") as jest.Mock;
const log = jest.spyOn(console, "log").mockImplementation(() => {});
const error = jest.spyOn(console, "error").mockImplementation(() => {});

afterAll(() => {
  log.mockRestore();
  error.mockRestore();
});

const roleBody = {
  movieId: 1234,
  actorId: 4321,
  roleName: 'Ellis Boyd "Red" Redding',
  roleDescription: "Narrator and deuteragonist.",
};

const event = (body: unknown): APIGatewayProxyEvent =>
  ({
    body: JSON.stringify(body),
    path: "/movies/roles",
    requestContext: { authorizer: { username: "doconnor" } },
  } as unknown as APIGatewayProxyEvent);

const bodyOf = (result: { body: string }) => JSON.parse(result.body);

const movieItem = { PK: "m#1234", SK: "m#1234" };
const actorItem = { PK: "a#4321", SK: "a#4321" };

beforeEach(() => {
  send.mockReset();
});

describe("validation", () => {
  const badBodies = [
    { ...roleBody, movieId: "1234" },
    { ...roleBody, movieId: 0 },
    { ...roleBody, actorId: -1 },
    { ...roleBody, actorId: 1.5 },
    { ...roleBody, roleName: "   " },
    { ...roleBody, roleDescription: 42 },
  ];

  test.each(badBodies)("returns 400 for %j", async (body) => {
    const result = await handler(event(body));

    expect(result.statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  test("returns 400 when the body is not valid json", async () => {
    const result = await handler({
      body: "not json",
      requestContext: {},
    } as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("lookups", () => {
  test("returns 404 when the movie is missing", async () => {
    send.mockResolvedValueOnce({ Item: undefined });

    const result = await handler(event(roleBody));

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result).message).toBe("Movie 1234 not found");
    expect(send).toHaveBeenCalledTimes(1);
  });

  test("returns 404 when the actor is missing", async () => {
    send
      .mockResolvedValueOnce({ Item: movieItem })
      .mockResolvedValueOnce({ Item: undefined });

    const result = await handler(event(roleBody));

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result).message).toBe("Actor 4321 not found");
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe("writing the role", () => {
  test("writes the role and returns 201", async () => {
    send
      .mockResolvedValueOnce({ Item: movieItem })
      .mockResolvedValueOnce({ Item: actorItem })
      .mockResolvedValueOnce({});

    const result = await handler(event(roleBody));

    expect(result.statusCode).toBe(201);
    expect(bodyOf(result)).toEqual({ message: "Role added", data: roleBody });

    const put = send.mock.calls[2][0];
    expect(put.input.Item).toEqual({
      PK: "m#1234",
      SK: "a#4321",
      ...roleBody,
    });
    expect(put.input.ConditionExpression).toBe("attribute_not_exists(PK)");
  });

  test("trims extra spaces from the role text", async () => {
    send
      .mockResolvedValueOnce({ Item: movieItem })
      .mockResolvedValueOnce({ Item: actorItem })
      .mockResolvedValueOnce({});

    const result = await handler(
      event({ ...roleBody, roleName: "  Red  " })
    );

    expect(bodyOf(result).data.roleName).toBe("Red");
  });

  test("returns 409 when the role already exists", async () => {
    send
      .mockResolvedValueOnce({ Item: movieItem })
      .mockResolvedValueOnce({ Item: actorItem })
      .mockRejectedValueOnce(
        new ConditionalCheckFailedException({
          message: "The conditional request failed",
          $metadata: {},
        })
      );

    const result = await handler(event(roleBody));

    expect(result.statusCode).toBe(409);
    expect(bodyOf(result).message).toBe(
      "Actor 4321 already has a role in movie 1234"
    );
  });

  test("returns 500 for an unexpected failure", async () => {
    send
      .mockResolvedValueOnce({ Item: movieItem })
      .mockResolvedValueOnce({ Item: actorItem })
      .mockRejectedValueOnce(new Error("boom"));

    const result = await handler(event(roleBody));

    expect(result.statusCode).toBe(500);
    expect(bodyOf(result)).toEqual({ message: "Internal server error" });
  });
});

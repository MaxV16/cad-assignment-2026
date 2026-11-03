import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { actorKey, ddb, movieKey, type Role, tableName } from "../shared/db";
import { isResponse, parseJsonObject, response } from "../shared/http";
import { logRequest } from "../shared/request-logger";

// The IDs in the body are numbers, not strings like the path params.
const isId = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  logRequest(event);

  const body = parseJsonObject(event);
  if (isResponse(body)) return body;

  const { movieId, actorId, roleName, roleDescription } = body;

  if (!isId(movieId)) {
    return response(400, { message: "movieId must be a positive integer" });
  }
  if (!isId(actorId)) {
    return response(400, { message: "actorId must be a positive integer" });
  }
  if (!isText(roleName)) {
    return response(400, { message: "roleName must be a non empty string" });
  }
  if (!isText(roleDescription)) {
    return response(400, {
      message: "roleDescription must be a non empty string",
    });
  }

  const role: Role = {
    movieId,
    actorId,
    roleName: roleName.trim(),
    roleDescription: roleDescription.trim(),
  };

  try {
    const movieResult = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: movieKey(movieId), SK: movieKey(movieId) },
      })
    );
    if (!movieResult.Item) {
      return response(404, { message: `Movie ${movieId} not found` });
    }

    const actorResult = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: actorKey(actorId), SK: actorKey(actorId) },
      })
    );
    if (!actorResult.Item) {
      return response(404, { message: `Actor ${actorId} not found` });
    }

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: movieKey(movieId),
          SK: actorKey(actorId),
          ...role,
        },
        // Stops the same actor being added to the same movie twice.
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );

    return response(201, { message: "Role added", data: role });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return response(409, {
        message: `Actor ${actorId} already has a role in movie ${movieId}`,
      });
    }
    console.error("DynamoDB error:", err);
    return response(500, {
      message: "Internal server error",
      error: err,
    });
  }
};

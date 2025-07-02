import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand
} from "@aws-sdk/client-athena";

const client = new AthenaClient({ region: process.env.AWS_REGION });

export const handler = async () => {
  const command = new StartQueryExecutionCommand({
    QueryString: process.env.QUERY!,
    WorkGroup: process.env.WORKGROUP,
    QueryExecutionContext: {
      Database: process.env.DATABASE
    },
    ResultConfiguration: {
      OutputLocation: process.env.OUTPUT
    }
  });

  const result = await client.send(command);
  console.log("Started Athena query:", result.QueryExecutionId);

  return {
    statusCode: 200,
    body: JSON.stringify({ queryId: result.QueryExecutionId })
  };
};

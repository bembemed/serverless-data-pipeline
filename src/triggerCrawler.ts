import { GlueClient, StartCrawlerCommand } from "@aws-sdk/client-glue";
import { Handler } from "aws-lambda";

const glue = new GlueClient({ region: process.env.AWS_REGION });

export const handler: Handler = async (event) => {
  console.log("🟢 Received Glue Job Event:", JSON.stringify(event, null, 2));

  const crawlerName = process.env.CRAWLER_NAME || "AnalyticsDataCrawler";

  try {
    const command = new StartCrawlerCommand({ Name: crawlerName });
    await glue.send(command);
    console.log(`✅ Successfully started crawler: ${crawlerName}`);
  } catch (err) {
    console.error("❌ Failed to start Glue crawler:", err);
    throw err;
  }
};

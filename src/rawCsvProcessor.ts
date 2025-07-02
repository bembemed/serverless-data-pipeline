import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { GlueClient, StartJobRunCommand } from "@aws-sdk/client-glue"; // 🔒 Commented: Not used
import { SQSHandler } from "aws-lambda";
import csv from "csv-parser";
import { Readable } from "stream";
import { z } from "zod";

// Initialize AWS S3 client
const s3 = new S3Client({ region: process.env.AWS_REGION });
const glue = new GlueClient({ region: process.env.AWS_REGION }); // 🔒 Commented

const cleanBucket = process.env.CLEAN_BUCKET!;
const glueJobName = "transformCsvJob"; // 🔒 Commented
const analyticsBucket = cleanBucket.replace("clean-data", "analytics-data"); // 🔒 Commented

const schema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  score: z.string().regex(/^[0-9]+$/),
  date: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: "Invalid date format"
  })
});

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      const bucket = body.Records?.[0]?.s3?.bucket?.name;
      const key = decodeURIComponent(body.Records?.[0]?.s3?.object?.key.replace(/\+/g, " "));

      if (!bucket || !key) {
        console.error("Invalid S3 event structure");
        continue;
      }

      const cleanKey = key.replace("input/", "cleaned/");

      const getObjectResponse = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const s3Stream = getObjectResponse.Body as Readable;

      const cleanedRows: any[] = [];

      await new Promise<void>((resolve, reject) => {
        s3Stream
          .pipe(csv())
          .on("data", (row) => {
            const parsed = schema.safeParse(row);
            if (parsed.success && Number(parsed.data.score) >= 0) {
              cleanedRows.push(parsed.data);
            } else {
              console.warn("Invalid row skipped:", row);
            }
          })
          .on("end", resolve)
          .on("error", reject);
      });

      const csvHeader = "id,name,email,score,date";
      const csvData = cleanedRows.map(r => `${r.id},${r.name},${r.email},${r.score},${r.date}`);
      const finalCSV = `${csvHeader}\n${csvData.join("\n")}`;

      await s3.send(new PutObjectCommand({
        Bucket: cleanBucket,
        Key: cleanKey,
        Body: finalCSV,
        ContentType: "text/csv"
      }));

      // 🔒 Commented: Glue job no longer runs
      
      await glue.send(new StartJobRunCommand({
        JobName: glueJobName,
        Arguments: {
          "--input_path": `s3://${cleanBucket}/cleaned/`,
          "--output_path": `s3://${analyticsBucket}/final/`
        }
      }));
      

      console.log(`✅ Processed file: ${key} → ${cleanKey}`);

    } catch (err) {
      console.error("❌ Error handling record:", err);
    }
  }
};

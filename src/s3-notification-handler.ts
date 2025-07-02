const { S3Client, PutBucketNotificationConfigurationCommand } = require("@aws-sdk/client-s3");
const https = require("https");
const url = require("url");

exports.handler = async (event) => {
  console.log("📦 Custom Resource Event:", JSON.stringify(event, null, 2));
  const s3 = new S3Client();

  if (event.RequestType === "Delete") {
    return sendResponse(event, "SUCCESS");
  }

  const bucketName = event.ResourceProperties.BucketName;
  const queueArn = event.ResourceProperties.QueueArn;
  const suffix = event.ResourceProperties.FilterSuffix || ".csv";

  const notificationConfig = {
    Bucket: bucketName,
    NotificationConfiguration: {
      QueueConfigurations: [
        {
          Events: ["s3:ObjectCreated:*"],
          QueueArn: queueArn,
          Filter: {
            Key: {
              FilterRules: [
                { Name: "suffix", Value: suffix }
              ]
            }
          }
        }
      ]
    }
  };

  try {
    await s3.send(new PutBucketNotificationConfigurationCommand(notificationConfig));
    console.log("✅ S3 notification configured successfully.");
    return sendResponse(event, "SUCCESS");
  } catch (err) {
    console.error("❌ Error setting notification:", err);
    return sendResponse(event, "FAILED", { error: err.message || "Unknown error" });
  }
};

/**
 * Sends a CloudFormation response back to the service.
 * @param {object} event The event from CloudFormation
 * @param {string} status "SUCCESS" or "FAILED"
 * @param {{ error?: string }} data Optional data object with an optional 'error' message
 */
function sendResponse(event, status, data = {}) {
  const errorMessage = "error" in data ? data.error : "OK";

  const responseBody = JSON.stringify({
    Status: status,
    Reason: errorMessage,
    PhysicalResourceId: event.PhysicalResourceId || event.LogicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: data,
  });

  const parsedUrl = url.parse(event.ResponseURL);
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: "PUT",
    headers: {
      "Content-Type": "",
      "Content-Length": Buffer.byteLength(responseBody),
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      console.log(`📬 CloudFormation responded with status code: ${response.statusCode}`);
      resolve(undefined);
    });

    request.on("error", (error) => {
      console.error("❌ Failed to send CloudFormation response:", error);
      reject(error);
    });

    request.write(responseBody);
    request.end();
  });
}


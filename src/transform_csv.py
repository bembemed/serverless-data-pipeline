import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job
from pyspark.sql.functions import col

# ⬇️ Get dynamic arguments
args = getResolvedOptions(sys.argv, ['JOB_NAME', 'input_path', 'output_path'])

# ⬇️ Glue job setup
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

# ✅ Read cleaned CSV from S3
df = spark.read.option("header", "true").csv(args['input_path'])

# ✅ Transform: convert 'score' to int, filter >= 50
df_transformed = df.withColumn("score", col("score").cast("int")) \
                   .filter(col("score") >= 50)

# ✅ Write result to output bucket
df_transformed.write.mode("overwrite").option("header", "true").csv(args['output_path'])

job.commit()

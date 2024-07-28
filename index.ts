import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z, ZodTypeAny } from 'zod';
import { env } from 'hono/adapter';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = new Hono();

type Environment = {
  GOOGLE_API_KEY: string;
};

app.use(cors());

const determineSchemaType = (schema: any): string => {
  if (!schema.hasOwnProperty('type')) {
    if (Array.isArray(schema)) {
      return 'array';
    } else {
      return typeof schema;
    }
  }
  return schema.type;
};

// Function to convert JSON schema to Zod schema
const jsonSchemaToZod = (schema: any): ZodTypeAny => {
  const type = determineSchemaType(schema);
  switch (type) {
    case 'string':
      return z.string().nullable();
    case 'number':
      return z.number().nullable();
    case 'boolean':
      return z.boolean().nullable();
    case 'array':
      return z.array(jsonSchemaToZod(schema.items)).nullable();
    case 'object':
      const shape: Record<string, ZodTypeAny> = {};
      for (const key in schema) {
        shape[key] = jsonSchemaToZod(schema[key]);
      }
      return z.object(shape);
    default:
      throw new Error(`Unsupported schema type: ${type}`);
  }
};

// Retry mechanism 
type PromiseExecutor<T> = (
  resolve: (value: T) => void,
  reject: (reason?: any) => void
) => void;

class RetryablePromise<T> extends Promise<T> {
  static async retry<T>(
    retries: number,
    executor: PromiseExecutor<T>
  ): Promise<T> {
    return new RetryablePromise<T>(executor).catch((error) => {
      console.error(`Retrying due to error: ${error}`);
      return retries > 0
        ? RetryablePromise.retry(retries - 1, executor)
        : RetryablePromise.reject(error);
    });
  }
}

// POST endpoint
app.post('/', async (c) => {
  const body = await c.req.json();

  const inputSchema = z.object({
    input: z.string(),
    format: z.object({}).passthrough(),
  });

  const { input, format } = inputSchema.parse(body);
  const generatedSchema = jsonSchemaToZod(format);

  const validationResult = await RetryablePromise.retry<string>(
    3,
    async (resolve, reject) => {
      try {
        console.log('We making it here!');
        const { GOOGLE_API_KEY } = env<Environment>(c);
        const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });

        const prompt = `
          You are an AI tasked with converting unstructured text data into a structured JSON format based on a provided schema. Your response should be a strictly valid JSON object that matches the schema format described below.
          
          **Instructions:**
          
          1. **Start and End**: Begin your response with an opening curly brace \`{\` and end with a closing curly brace \`}\`.
          2. **Mapping**: Use the provided \`format\` to determine the structure of the output JSON. Map the values extracted from the \`input\` data according to the fields specified in the \`format\`.
          3. **Missing Data**: If a field specified in the \`format\` cannot be derived from the \`input\` data, set its value to \`null\`.
          
          **Examples:**
          1. **Example 1:**
            - \`input\`: "My name is John and I am 25 years old."
            - \`format\`: {
                "name": {"type": "string"},
                "age": {"type": "number"}
              }
            - **Expected Output:**
              \`\`\`json
              {
                "name": "John",
                "age": 25
              }
              \`\`\`
          2. **Example 2:**
            - \`input\`: "Contact me at john.doe@example.com."
            - \`format\`: {
                "email": {"type": "string"}
              }
            - **Expected Output:**
              \`\`\`json
              {
                "email": "john.doe@example.com"
              }
              \`\`\`
          3. **Example 3:**
            - \`input\`: "The event starts on December 12, 2024."
            - \`format\`: {
                "event_date": {"type": "string"}
              }
            - **Expected Output:**
              \`\`\`json
              {
                "event_date": "December 12, 2024"
              }
              \`\`\`
          4. **Example 4:**
            - \`input\`: "My address is 123 Maple Street."
            - \`format\`: {
                "street": {"type": "string"},
                "city": {"type": "string"}
              }
            - **Expected Output:**
              \`\`\`json
              {
                "street": "123 Maple Street",
                "city": null
              }
              \`\`\`
          5. **Example 5:**
            - \`input\`: "Alice has a cat named Whiskers."
            - \`format\`: {
                "name": {"type": "string"},
                "pet": {"type": "string"}
              }
            - **Expected Output:**
              \`\`\`json
              {
                "name": "Alice",
                "pet": "Whiskers"
              }
              \`\`\`
          
          **Input Data:**
          - \`input\`: "${input}"
          - \`format\`: ${JSON.stringify(format, null, 2)}
          
          **Output:**
          Your output should be a valid JSON object that precisely matches the structure defined by the \`format\`. Ensure there is no additional text, explanation, or content outside the JSON object.
        `;

        const res = await model.generateContent(prompt);
        const validationResult = generatedSchema.parse(JSON.parse(res.response.text() || ''));

        return resolve(validationResult);
      } catch (err) {
        reject(err);
      }
    }
  );

  return Response.json(validationResult, { status: 200 });
});

export default app;

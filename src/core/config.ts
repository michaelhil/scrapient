import { z } from 'zod';
import { existsSync } from 'fs';
import path from 'path';

// Environment schema with validation
const EnvironmentSchema = z.object({
  // Server configuration
  PORT: z.string()
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0 && val < 65536, 'Port must be between 1 and 65535')
    .default('3000'),

  // MongoDB configuration
  MONGO_URI: z.string()
    .url('MONGO_URI must be a valid URL')
    .refine(uri => uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'),
           'MONGO_URI must be a valid MongoDB connection string')
    .default('mongodb://localhost:27017/scrapient'),

  // LLM model configuration
  LLM_MODEL_PATH: z.string()
    .optional()
    .refine(path => !path || existsSync(path), 'LLM model file does not exist'),

  // Environment type
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Security configuration
  CORS_ORIGIN: z.string()
    .optional()
    .refine(origin => !origin || isValidOrigin(origin), 'Invalid CORS origin'),

  // Optional API keys (for future integrations)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // File upload limits
  MAX_FILE_SIZE: z.string()
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0 && val <= 100 * 1024 * 1024, 'Max file size must be between 1B and 100MB')
    .default('50000000'), // 50MB

  // Temp directory
  TEMP_DIR: z.string()
    .refine(dir => existsSync(dir), 'Temp directory does not exist')
    .default('/tmp'),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

// Runtime configuration derived from environment
export interface AppConfig {
  server: {
    port: number;
    host: string;
    corsOrigin: string[];
  };
  database: {
    mongoUri: string;
  };
  llm: {
    modelPath?: string;
  };
  security: {
    maxFileSize: number;
    allowedFileTypes: string[];
  };
  paths: {
    tempDir: string;
    modelsDir: string;
  };
}

// Validate CORS origin format
const isValidOrigin = (origin: string): boolean => {
  if (origin === '*') return true;

  try {
    // Allow comma-separated origins
    const origins = origin.split(',').map(o => o.trim());
    return origins.every(o => {
      // Check if it's a valid URL or wildcard pattern
      return o === '*' ||
             /^https?:\/\//.test(o) ||
             /^[\w-]+\.[\w.-]+$/.test(o);
    });
  } catch {
    return false;
  }
};

// Load and validate configuration
export const loadConfig = (): { config: AppConfig; env: Environment } => {
  try {
    // Parse and validate environment variables
    const env = EnvironmentSchema.parse(process.env);

    // Derive application configuration
    const config: AppConfig = {
      server: {
        port: env.PORT,
        host: '0.0.0.0',
        corsOrigin: env.CORS_ORIGIN
          ? env.CORS_ORIGIN.split(',').map(o => o.trim())
          : ['http://localhost:3000', 'http://127.0.0.1:3000'],
      },
      database: {
        mongoUri: env.MONGO_URI,
      },
      llm: {
        modelPath: env.LLM_MODEL_PATH || path.join(process.cwd(), 'models', 'llama-3.1-8b-instruct.gguf'),
      },
      security: {
        maxFileSize: env.MAX_FILE_SIZE,
        allowedFileTypes: ['.pdf', '.txt', '.md', '.json'],
      },
      paths: {
        tempDir: env.TEMP_DIR,
        modelsDir: path.join(process.cwd(), 'models'),
      },
    };

    return { config, env };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err =>
        `${err.path.join('.')}: ${err.message}`
      ).join('\n');

      throw new Error(`Configuration validation failed:\n${errorMessages}`);
    }

    throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Validate configuration at startup
export const validateConfig = (): void => {
  const { config } = loadConfig();

  // Additional runtime validations
  const validations = [
    {
      check: () => config.server.port > 0 && config.server.port < 65536,
      message: 'Server port must be between 1 and 65535'
    },
    {
      check: () => config.llm.modelPath ? existsSync(config.llm.modelPath) : true,
      message: 'LLM model file does not exist'
    },
    {
      check: () => existsSync(config.paths.tempDir),
      message: 'Temporary directory does not exist'
    },
  ];

  for (const validation of validations) {
    if (!validation.check()) {
      throw new Error(`Configuration error: ${validation.message}`);
    }
  }

  console.log('✅ Configuration validated successfully');
};

// Development helper to show current config
export const showConfig = (): void => {
  const { config, env } = loadConfig();

  console.log('📋 Current Configuration:');
  console.log('========================');
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Server: http://localhost:${config.server.port}`);
  console.log(`MongoDB: ${config.database.mongoUri}`);
  console.log(`LLM Model: ${config.llm.modelPath || 'Not configured'}`);
  console.log(`Temp Dir: ${config.paths.tempDir}`);
  console.log(`Max File Size: ${(config.security.maxFileSize / 1024 / 1024).toFixed(1)}MB`);
  console.log(`CORS Origins: ${config.server.corsOrigin.join(', ')}`);
  console.log('========================');
};

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { posix } from 'node:path';
import { Sandbox } from 'e2b';

type ChatToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type ChatFunctionTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type ChatMessages = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ChatToolCall[];
  toolCallId?: string;
};

type ChatResult = { choices: { message: ChatMessages }[] };

declare const Bun: any;

// Read environment variables
function readDotEnv(filePath: string): Record<string, string> {
  try {
    const envText = readFileSync(filePath, 'utf8');
    const env: Record<string, string> = {};

    for (const rawLine of envText.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;

      const [, key, value] = match;
      env[key] = value.replace(/^['"]|['"]$/g, '').trim();
    }

    return env;
  } catch {
    return {};
  }
}

const envFile = readDotEnv(
  fileURLToPath(new URL('./.env', import.meta.url))
);

const OPENROUTER_API_KEY = (
  Bun.env.OPENROUTER_API_KEY ??
  envFile.OPENROUTER_API_KEY ??
  ''
).trim();

if (
  !OPENROUTER_API_KEY ||
  /[•…]/.test(OPENROUTER_API_KEY) ||
  OPENROUTER_API_KEY.includes('...') ||
  OPENROUTER_API_KEY.length < 20
) {
  throw new Error(
    'OPENROUTER_API_KEY is missing or still contains placeholder text.'
  );
}

// E2B configuration
const E2B_API_KEY = (
  Bun.env.E2B_API_KEY ??
  envFile.E2B_API_KEY ??
  ''
).trim();

const GITHUB_REPO_URL = (
  Bun.env.GITHUB_REPO_URL ??
  envFile.GITHUB_REPO_URL ??
  ''
).trim();

if (!E2B_API_KEY) {
  throw new Error('E2B_API_KEY is missing.');
}

if (!GITHUB_REPO_URL) {
  throw new Error('GITHUB_REPO_URL is missing.');
}

// Make the key available to E2B SDK
Bun.env.E2B_API_KEY = E2B_API_KEY;

// Project directory inside E2B
const REPO_DIR = '/tmp/repo';

// Create E2B sandbox and clone repository
console.log('Creating E2B sandbox...');

const sandbox = await Sandbox.create({
  timeoutMs: 10 * 60 * 1000,
  requestTimeoutMs: 30_000,
});

try {
  console.log('Cloning GitHub repository...');

  await sandbox.commands.run(
    `git clone --depth 1 '${GITHUB_REPO_URL.replace(/'/g, "'\\''")}' ${REPO_DIR}`,
    { timeoutMs: 120_000 }
  );

  console.log('Repository cloned successfully!');
} catch (error) {
  await sandbox.kill();
  throw error;
}

// Send request to OpenRouter
async function sendChat(
  messages: ChatMessages[],
  tools: ChatFunctionTool[]
): Promise<ChatResult> {
  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + OPENROUTER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        tools,
        messages: messages.map(
          ({ role, content, toolCalls, toolCallId }) => ({
            role,
            content,
            ...(toolCalls ? { tool_calls: toolCalls } : {}),
            ...(toolCallId ? { tool_call_id: toolCallId } : {}),
          })
        ),
        max_tokens: 4000,
        stream: false,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `OpenRouter request failed (${response.status}): ${await response.text()}`
    );
  }

  const result = (await response.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: ChatToolCall[];
      };
    }[];
  };

  return {
    choices: (result.choices ?? []).map(({ message }) => ({
      message: {
        role: 'assistant',
        content: message?.content ?? '',
        ...(message?.tool_calls
          ? { toolCalls: message.tool_calls }
          : {}),
      },
    })),
  };
}

// Define available tools for the main agent
const tools: ChatFunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'bash',
      description:
        'Run a bash command inside the E2B sandbox to explore the repository.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read the contents of a file inside the cloned GitHub repository. Provide a relative file path, such as README.md.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path of the file inside the repository',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delegate_exploration',
      description:
        'Delegate repository exploration, architecture analysis, or code understanding to the Explore Subagent.',
      parameters: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'What the subagent should investigate',
          },
        },
        required: ['task'],
      },
    },
  },
];

// Tools available only to the Explore Subagent
const exploreTools: ChatFunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description:
        'List files and folders inside the repository.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read a file inside the repository using its relative path.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative file path',
          },
        },
        required: ['path'],
      },
    },
  },
];

// Execute commands inside E2B sandbox
async function runBash(command: string) {
  const result = await sandbox.commands.run(
    `cd ${REPO_DIR} && ${command}`,
    { timeoutMs: 60_000 }
  );

  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

// Read file contents safely inside E2B project directory
async function readProjectFile(filePath: string) {
  const fullPath = posix.resolve(REPO_DIR, filePath);
  const relativePath = posix.relative(REPO_DIR, fullPath);

  // Prevent reading files outside the repository
  if (
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    posix.isAbsolute(relativePath)
  ) {
    throw new Error(
      'Access denied: File must be inside the repository.'
    );
  }

  return await sandbox.files.read(fullPath);
}

// Explore Subagent
async function exploreSubagent(task: string) {
  console.log('\nExplore Subagent started...');

  const subagentMessages: ChatMessages[] = [
    {
      role: 'system',
      content: `
You are a repository exploration subagent.

Your job is to explore and understand the project.

You can:
1. List files and folders.
2. Read source files.
3. Understand project architecture.
4. Trace how features work.
5. Report bugs or potential issues.

You must not modify, delete, or create files.

The repository is located at ${REPO_DIR}.

Always inspect actual files before making conclusions.
Return a clear report with relevant file paths.
`,
    },
    {
      role: 'user',
      content: task,
    },
  ];

  // Subagent has its own tool-calling loop
  const maxSubagentIterations = 5;

  for (let i = 0; i < maxSubagentIterations; i++) {
    const response = await sendChat(subagentMessages, exploreTools);
    const choice = response.choices[0];

    if (!choice) {
      throw new Error('Explore Subagent returned no response.');
    }

    subagentMessages.push(choice.message);

    const toolCalls = choice.message.toolCalls;

    // Subagent has finished its task
    if (!toolCalls || toolCalls.length === 0) {
      console.log('Explore Subagent completed.');

      return choice.message.content;
    }

    // Execute subagent tools
    for (const toolCall of toolCalls) {
      const { name, arguments: args } = toolCall.function;
      const input = JSON.parse(args);

      console.log(`Explore Subagent tool: ${name}`);

      let toolResult;

      try {
        if (name === 'list_files') {
          const result = await sandbox.commands.run(
            `cd ${REPO_DIR} && find . -maxdepth 3 -not -path './.git*' -print | sort`,
            { timeoutMs: 30_000 }
          );

          toolResult = {
            success: true,
            files: result.stdout.slice(0, 20_000),
          };
        } else if (name === 'read_file') {
          toolResult = {
            success: true,
            content: await readProjectFile(input.path),
          };
        } else {
          throw new Error(`Unknown subagent tool: ${name}`);
        }
      } catch (error) {
        toolResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      subagentMessages.push({
        role: 'tool',
        toolCallId: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  return 'Explore Subagent reached its maximum iteration limit.';
}

// Initial conversation
const messages: ChatMessages[] = [
  {
    role: 'system',
    content: `
You are a helpful coding agent.

You have three tools:

1. bash: Run commands inside the E2B sandbox.
2. read_file: Read files from the cloned GitHub repository.
3. delegate_exploration: Delegate repository exploration and architecture analysis to the Explore Subagent.

The repository is located at ${REPO_DIR}.

Always inspect files before explaining their implementation.
Do not guess file contents based only on filenames.
Use read_file when the user asks about a particular file.
File paths provided to read_file must be relative to the repository directory.

When a task requires understanding multiple files or the overall project architecture,
use the Explore Subagent and incorporate its findings into your response.

Do not access files outside the repository.
`,
  },
  {
    role: 'user',
    content: 'Can you tell me more about the cloned GitHub project?',
  },
];

// Call LLM
async function callLLM(
  messages: ChatMessages[]
): Promise<ChatResult> {
  const result = await sendChat(messages, tools);

  const choice = result.choices[0];

  if (!choice) {
    throw new Error('Expected the model to return a choice');
  }

  messages.push(choice.message);

  return result;
}

// Handle tool calls
async function getToolResponse(
  toolCall: ChatToolCall
): Promise<ChatMessages> {
  const { name, arguments: args } = toolCall.function;
  const input = JSON.parse(args);

  console.log(`Tool called: ${name}`);

  try {
    let toolResult;

    if (name === 'bash') {
      console.log(`$ ${input.command}`);
      toolResult = await runBash(input.command);
    } 
    else if (name === 'read_file') {
      console.log(`Reading file: ${input.path}`);

      toolResult = {
        success: true,
        content: await readProjectFile(input.path),
      };
    }
    else if (name === 'delegate_exploration') {
      console.log('Delegating task to Explore Subagent...');

      toolResult = {
        success: true,
        report: await exploreSubagent(input.task),
      };
    }
    else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return {
      role: 'tool',
      toolCallId: toolCall.id,
      content: JSON.stringify(toolResult),
    };
  } catch (error) {
    return {
      role: 'tool',
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

// Agent execution loop
const maxIterations = 10;

let iterationCount = 0;
let didReachMaxIterations = true;

try {
  while (iterationCount < maxIterations) {
    iterationCount++;

    const response = await callLLM(messages);
    const choice = response.choices[0];

    if (!choice) {
      throw new Error('Expected the model to return a choice');
    }

    const toolCalls = choice.message.toolCalls;

    if (!toolCalls || toolCalls.length === 0) {
      didReachMaxIterations = false;
      break;
    }

    for (const toolCall of toolCalls) {
      messages.push(await getToolResponse(toolCall));
    }
  }

  if (didReachMaxIterations) {
    console.warn('Warning: Maximum iterations reached');
  }

  console.log('\nFinal Answer:\n');
  console.log(messages[messages.length - 1]?.content);
} finally {
  // Close sandbox when the agent finishes
  await sandbox.kill();
}

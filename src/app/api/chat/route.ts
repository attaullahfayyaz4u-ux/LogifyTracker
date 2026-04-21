import { createGroq } from '@ai-sdk/groq';
import { streamText, jsonSchema, convertToModelMessages } from 'ai';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const groq = createGroq();
const execAsync = promisify(exec);

async function gitCommit(message: string) {
  try {
    await execAsync('git add .');
    await execAsync(`git commit -m "${message}" --allow-empty`);
  } catch (e) {
    console.log('Git commit failed:', e);
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  const constitution = await fs.readFile('AGENTS.md', 'utf-8');

  let memory = '';
  try {
    memory = await fs.readFile('PROJECT_STATE.md', 'utf-8');
  } catch {
    memory = 'PROJECT_STATE.md is empty. Project just started.';
  }

  const systemPrompt = `${constitution}

<current_project_state>
${memory}
</current_project_state>`;

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      request_clarification: {
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            context: { type: 'string' },
            recommendation: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                rationale: { type: 'string' },
              },
              required: ['id', 'label', 'rationale'],
            },
            alternatives: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  label: { type: 'string' },
                  rationale: { type: 'string' },
                },
                required: ['id', 'label', 'rationale'],
              },
            },
            stack_enforcement_warning: { type: 'string' },
          },
          required: ['context', 'recommendation', 'alternatives', 'stack_enforcement_warning'],
        }),
      },

      update_project_memory: {
        description: 'Update PROJECT_STATE.md with new architectural decisions.',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            updated_state: { type: 'string' },
          },
          required: ['updated_state'],
        }),
        execute: async ({ updated_state }: { updated_state: string }) => {
          await fs.writeFile('PROJECT_STATE.md', updated_state);
          return 'Memory updated successfully.';
        },
      },

      write_file: {
        description: 'Write code to a file path. Creates directories if needed.',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            path: { type: 'string' },
            code: { type: 'string' },
          },
          required: ['path', 'code'],
        }),
        execute: async ({ path, code }: { path: string; code: string }) => {
          const dir = path.substring(0, path.lastIndexOf('/'));
          if (dir) await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(path, code);
          await gitCommit(`auto-gen: create/modify ${path}`);
          return `Successfully wrote and committed ${path}`;
        },
      },
    },
    maxSteps: 20,
  });

  return result.toUIMessageStreamResponse();
}

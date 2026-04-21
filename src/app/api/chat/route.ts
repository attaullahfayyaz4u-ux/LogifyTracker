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
              properties: { id: { type: 'string' }, label: { type: 'string' }, rationale: { type: 'string' } },
              required: ['id', 'label', 'rationale'],
            },
            alternatives: {
              type: 'array',
              items: {
                type: 'object',
                properties: { id: { type: 'string' }, label: { type: 'string' }, rationale: { type: 'string' } },
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
          properties: { updated_state: { type: 'string' } },
          required: ['updated_state'],
        }),
        execute: async ({ updated_state }: { updated_state: string }) => {
          await fs.writeFile('PROJECT_STATE.md', updated_state);
          return 'Memory updated successfully.';
        },
      },

      write_file: {
        description: 'Write code to a file path inside a project folder. Path must start with projects/{project-name}/. Creates directories if needed.',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path starting with projects/{project-name}/ e.g. projects/logify-tracker/src/index.js' },
            code: { type: 'string' },
          },
          required: ['path', 'code'],
        }),
        execute: async ({ path, code }: { path: string; code: string }) => {
          const dir = path.substring(0, path.lastIndexOf('/'));
          if (dir) await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(path, code);
          await gitCommit(`auto-gen: ${path}`);
          return `✓ ${path}`;
        },
      },

      push_to_github: {
        description: 'Push all committed files to GitHub. Call this once after all write_file calls are done. If repo_url is provided and no remote exists, it will be added first.',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            repo_url: { type: 'string', description: 'GitHub repo URL e.g. https://github.com/user/repo.git — only needed if remote is not yet configured' },
            project_name: { type: 'string', description: 'Name of the project just built' },
          },
          required: ['project_name'],
        }),
        execute: async ({ repo_url, project_name }: { repo_url?: string; project_name: string }) => {
          try {
            // Check if remote exists
            const { stdout: remotes } = await execAsync('git remote').catch(() => ({ stdout: '' }));
            const hasOrigin = remotes.includes('origin');

            if (!hasOrigin) {
              if (!repo_url) {
                return `NO_REMOTE: No GitHub remote configured for "${project_name}". Please provide your GitHub repo URL to push.`;
              }
              await execAsync(`git remote add origin ${repo_url}`);
            } else if (repo_url) {
              await execAsync(`git remote set-url origin ${repo_url}`);
            }

            // Ensure branch is main
            await execAsync('git checkout -B main').catch(() => {});
            const { stdout, stderr } = await execAsync('git push -u origin main').catch(async (e: any) => {
              // Try force push if branch history mismatch
              return execAsync('git push -u origin main --force');
            });

            return `✓ Pushed "${project_name}" to GitHub successfully.`;
          } catch (e: any) {
            return `PUSH_FAILED: ${e.message}`;
          }
        },
      },
    },
    maxSteps: 20,
  });

  return result.toUIMessageStreamResponse();
}

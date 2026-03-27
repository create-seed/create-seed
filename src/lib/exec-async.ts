import { spawn } from 'node:child_process'

export interface ExecAsyncOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  shell?: boolean
  streamOutput?: boolean
}

export async function execAsync(command: string, args: string[], options: ExecAsyncOptions = {}): Promise<void> {
  const { shell = false, streamOutput = false, ...rest } = options
  return new Promise<void>((resolve, reject) => {
    const chunks: Buffer[] = []
    const child = spawn(command, args, {
      ...rest,
      shell,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout?.on('data', (data) => {
      chunks.push(data)
      if (streamOutput) {
        process.stdout.write(data)
      }
    })
    child.stderr?.on('data', (data) => {
      chunks.push(data)
      if (streamOutput) {
        process.stderr.write(data)
      }
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        const output = Buffer.concat(chunks).toString().trim()
        const message = [`${command} ${args.join(' ')} failed with exit code ${code}`, output]
          .filter(Boolean)
          .join('\n')
        reject(new Error(message))
      } else {
        resolve()
      }
    })
  })
}

import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentFile = fileURLToPath(import.meta.url)
const projectRoot = resolve(dirname(currentFile), '..')
const cliEntry = resolve(projectRoot, 'node_modules/electron-vite/bin/electron-vite.js')
const args = process.argv.slice(2)
const env = { ...process.env }

delete env.ELECTRON_RUN_AS_NODE

const child = spawn(process.execPath, [cliEntry, ...args], {
  cwd: projectRoot,
  env,
  stdio: 'inherit'
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

/**
 * Libera los puertos 3000 y 3001 (típico de `next dev`) para evitar
 * "Another next dev server is already running" / conflicto de puerto.
 * macOS/Linux: usa `lsof`. En Windows no hace nada (lanza `next dev` igual).
 */
import { execSync } from 'node:child_process'

const isWin = process.platform === 'win32'

if (!isWin) {
  for (const port of [3000, 3001]) {
    try {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, {
        stdio: 'ignore',
        shell: '/bin/sh',
      })
    } catch {
      // sin proceso en ese puerto
    }
  }
}

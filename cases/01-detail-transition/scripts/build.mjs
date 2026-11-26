// the release APK (Hermes, New Architecture, arm64-v8a), signed with the debug key the template ships
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const android = fileURLToPath(new URL('../android/', import.meta.url))
const win = process.platform === 'win32'
const gradlew = join(android, win ? 'gradlew.bat' : 'gradlew')
execFileSync(win ? `"${gradlew}"` : gradlew, ['assembleRelease', '--console=plain', '-q'], { cwd: android, stdio: 'inherit', shell: win })
console.log('-> android/app/build/outputs/apk/release/app-release.apk')

// the release APK (Hermes, New Architecture, arm64-v8a), signed with the debug key the template ships
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const android = fileURLToPath(new URL('../android/', import.meta.url))
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
execFileSync(gradlew, ['assembleRelease', '--console=plain', '-q'], { cwd: android, stdio: 'inherit', shell: process.platform === 'win32' })
console.log('-> android/app/build/outputs/apk/release/app-release.apk')

# Apple Music connection for Jarvis

This update connects https://jarvis-astin2.vercel.app to Music on the same Mac. It supports existing voice commands and new Play, Pause, Skip, Quieter and Louder buttons. Volume changes Music only, in increments of 10 (0–100). Typed chat and voice support play, pause, stop, skip and volume commands. Named requests such as “play More and More by Joe” select a matching song from your Music library. Ampersand and “and” in song titles are treated equivalently. If different artists match and none was specified, Jarvis asks for an artist. Multiple versions with the same title and artist use the first library match. This does not search the full Apple Music catalog: add a missing song to your Music library first, then retry.

## Publish the website update first

The website changes must be deployed before pairing. They are based on the current astintucker-bot/Jarvis repository. The supplied patch adds the helper, music panel and browser connection, and changes the existing voice music handler. It preserves the existing login, calendar and Word features.

From a clean checkout of that repository, run `git apply --check /path/to/jarvis-music.patch` and then `git apply /path/to/jarvis-music.patch`. Review and commit the changes, then push to the Vercel production branch. Wait for Vercel to show Ready. If the patch check fails, have Codex reconcile it with newer changes; do not overwrite newer files.

No new Vercel environment variables, Apple developer account or Apple ID password sharing are needed.

## Start and pair on your Mac

1. Open Music and check that it can play a song manually.
2. Open `Start-Jarvis-Music.command` in the helper folder. Keep Terminal open. The launcher requires Python 3, and can use the bundled Codex runtime on this Mac if needed.
3. Copy the pairing code printed by the helper. It is a local control credential, not your Apple password.
4. Open https://jarvis-astin2.vercel.app in Chrome on this same Mac and sign in. Complete any existing calendar connection screen if required by your Jarvis setup.
5. Open **Music settings**, then paste the code and click **CONNECT / CHECK**. Allow local network access if Chrome prompts. This first check queries playback state; it does not start music.
6. Allow Terminal to control Music if macOS prompts. Your existing Terminal → Music permission may already cover this.
7. When the panel says Connected, try **PLAY** and **QUIETER**, then use START / HOLD TO TALK to say “pause Apple Music.”

Closing Terminal or pressing Control-C stops the helper. Relaunching generates a new pairing code. Pairing is stored only in the current browser tab's session storage. DISCONNECT forgets that tab's code; stopping the helper disconnects every tab. Keep this Mac awake. This setup does not control a Mac from an iPhone or another computer.

If the helper cannot be reached, use Chrome on the same Mac and check the site's local-network permission. Browser policies vary; Safari is not validated for this local HTTP connection. Do not disable browser security settings. If Music denies a command, check System Settings → Privacy & Security → Automation → Terminal → Music.

## Technical verification and limits

The helper binds only to 127.0.0.1:18765, allows only the exact production website origin and loopback Host header, requires a random pairing token, limits request size, and executes only fixed AppleScript commands. It never accepts shell commands or arbitrary AppleScript from the browser. The token is never sent to Vercel or the voice model. No public tunnel or background service is installed.

Run helper tests with `python3 -m unittest discover -s mac-helper -p 'test_*.py'`. These use mocked AppleScript execution and do not play music. Live browser permission, Mac Automation and playback must still be tested after deployment on the user's Mac.

Browser permission reference: https://developer.chrome.com/blog/local-network-access

## Updating an existing helper

The upgraded helper is saved over the existing helper file. In its Terminal window press Control-C, then launch Start-Jarvis-Music.command again. Copy the new pairing code, refresh Jarvis, reconnect through Music settings, and restart any active voice conversation so it receives the new song tool. Try typing “play More and More by Joe”. The track must already be in the Music library.

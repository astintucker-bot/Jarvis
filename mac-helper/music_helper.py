#!/usr/bin/env python3
"""Local Apple Music control. No third-party dependencies or remote listener."""
import hmac
import json
import secrets
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer

ORIGIN = 'https://jarvis-astin2.vercel.app'
PORT = 18765
SCRIPTS = {
    'status': 'tell application "Music" to get player state',
    'play': 'tell application "Music" to play',
    'stop': 'tell application "Music" to stop',
    'pause': 'tell application "Music" to pause',
    'next': 'tell application "Music" to next track',
    'volume_up': 'tell application "Music"\nset v to sound volume + 10\nif v > 100 then set v to 100\nset sound volume to v\nend tell',
    'volume_down': 'tell application "Music"\nset v to sound volume - 10\nif v < 0 then set v to 0\nset sound volume to v\nend tell',
}
SONG_SCRIPT = 'on run argv\nset requestedTitle to item 1 of argv\nset requestedArtist to item 2 of argv\ntell application "/System/Applications/Music.app"\nset matches to search library playlist 1 for (word 1 of requestedTitle) only names\nset selectedTrack to missing value\nset selectedArtist to ""\nrepeat with candidate in matches\nset candidateTitle to name of candidate as text\nset candidateArtist to artist of candidate as text\nignoring case\nset titleMatches to (my canonicalTitle(candidateTitle)) is (my canonicalTitle(requestedTitle))\nset artistMatches to requestedArtist is "" or candidateArtist is requestedArtist\nend ignoring\nif titleMatches and artistMatches then\nif selectedTrack is not missing value and requestedArtist is "" then\nignoring case\nif candidateArtist is not selectedArtist then return "AMBIGUOUS"\nend ignoring\nend if\nif selectedTrack is missing value then\nset selectedTrack to contents of candidate\nset selectedArtist to candidateArtist\nend if\nend if\nend repeat\nif selectedTrack is missing value then return "NO_MATCH"\nplay selectedTrack\nreturn "TRACK" & tab & (name of selectedTrack as text) & tab & (artist of selectedTrack as text)\nend tell\nend run\n\non canonicalTitle(value)\nset savedDelimiters to AppleScript\'s text item delimiters\nset AppleScript\'s text item delimiters to "&"\nset pieces to text items of value\nset AppleScript\'s text item delimiters to "and"\nset normalized to pieces as text\nset AppleScript\'s text item delimiters to savedDelimiters\nreturn normalized\nend canonicalTitle'
TOKEN = secrets.token_urlsafe(24)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Never log pairing credentials.

    def reply(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        if self.headers.get('Origin') == ORIGIN:
            self.send_header('Access-Control-Allow-Origin', ORIGIN)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def valid_origin(self):
        return (self.headers.get('Origin') == ORIGIN and
                self.headers.get('Host') == '127.0.0.1:%s' % PORT)

    def do_OPTIONS(self):
        self.reply(200 if self.valid_origin() and self.path == '/music' else 403, {})

    def do_POST(self):
        self.connection.settimeout(5)
        if not self.valid_origin():
            return self.reply(403, {'error': 'Website not allowed.'})
        if self.path != '/music':
            return self.reply(404, {'error': 'Not found.'})
        if not hmac.compare_digest(self.headers.get('Authorization', '').encode(), ('Bearer ' + TOKEN).encode()):
            return self.reply(401, {'error': 'Paste the current pairing code from the helper Terminal window.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 1024:
                return self.reply(400, {'error': 'Invalid request size.'})
            body = json.loads(self.rfile.read(length))
            action = body.get('action') if isinstance(body, dict) else None
            if not isinstance(action, str) or action not in (*SCRIPTS, 'play_song'):
                return self.reply(400, {'error': 'Unsupported music action.'})
            title, artist = body.get('title', ''), body.get('artist', '')
            if action == 'play_song' and (not isinstance(title, str) or not title.strip() or not isinstance(artist, str) or len(title) > 200 or len(artist) > 200 or any(ord(c) < 32 for c in title + artist)):
                return self.reply(400, {'error': 'Provide a song title and optional artist, each at most 200 characters.'})
        except (ValueError, OSError):
            return self.reply(400, {'error': 'Invalid request.'})
        try:
            command = ['/usr/bin/osascript', '-e', SONG_SCRIPT, '--', title.strip(), artist.strip()] if action == 'play_song' else ['/usr/bin/osascript', '-e', SCRIPTS[action]]
            result = subprocess.run(command,
                                    capture_output=True, text=True, timeout=20, check=True)
            state = result.stdout.strip()
            if action == 'play_song':
                if state == 'NO_MATCH':
                    return self.reply(404, {'error': 'That song was not found in your Music library. Add it to your library in Apple Music, then ask again. This connection searches your library, not the full Apple Music catalog.'})
                if state == 'AMBIGUOUS':
                    return self.reply(409, {'error': 'Several artists have that song title in your library. Include the artist, for example: play More and More by Joe.'})
                if not state.startswith('TRACK\t'):
                    return self.reply(503, {'error': 'Music did not confirm the selected song.'})
                return self.reply(200, {'ok': True, 'action': action, 'message': 'Playing ' + state[6:].replace('\t', ' by ', 1) + '.'})
            self.reply(200, {'ok': True, 'action': action, 'state': state})
        except (subprocess.SubprocessError, OSError):
            self.reply(503, {'error': 'Music did not respond. Open Music and allow Terminal to control Music in System Settings > Privacy & Security > Automation, then retry.'})


def main():
    try:
        server = HTTPServer(('127.0.0.1', PORT), Handler)
    except OSError:
        print('The music helper port is already in use. Close the other helper window and retry.')
        return
    print('\nJARVIS MUSIC HELPER\nKeep this Terminal window open.\n', flush=True)
    print('Pairing code (paste into Apple Music on your Jarvis website):\n' + TOKEN, flush=True)
    print('\nOpen ' + ORIGIN + ' in Chrome on THIS Mac.\nPress Control-C to stop. Restarting changes the pairing code.\n', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()

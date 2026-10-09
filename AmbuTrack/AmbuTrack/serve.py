"""Local static server. Uses only the Python standard library."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

if __name__ == '__main__':
    handler = partial(SimpleHTTPRequestHandler, directory=str(Path(__file__).parent / 'dist'))
    server = ThreadingHTTPServer(('127.0.0.1', 8000), handler)
    print('AmbuTrack is ready at http://localhost:8000. Press Ctrl+C to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nAmbuTrack stopped.')
    finally:
        server.server_close()

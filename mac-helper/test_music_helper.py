import http.client
import json
import threading
import unittest
from unittest.mock import patch
import music_helper as helper

class HelperTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = helper.HTTPServer(('127.0.0.1', 0), helper.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, body=None, origin=helper.ORIGIN, token=helper.TOKEN, method='POST', host=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        headers = {'Origin': origin, 'Host': host or '127.0.0.1:18765',
                   'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}
        connection.request(method, '/music', json.dumps(body or {'action': 'status'}), headers)
        response = connection.getresponse()
        result = (response.status, dict(response.getheaders()), json.loads(response.read()))
        connection.close()
        return result

    @patch('music_helper.subprocess.run')
    def test_rejects_untrusted_requests_without_execution(self, run):
        self.assertEqual(self.request(origin='https://evil.example')[0], 403)
        self.assertEqual(self.request(token='wrong')[0], 401)
        self.assertEqual(self.request(host='evil.example:18765')[0], 403)
        self.assertEqual(self.request({'action': 'do shell script'})[0], 400)
        self.assertEqual(self.request({'action': []})[0], 400)
        run.assert_not_called()

    def test_preflight_is_limited_to_expected_website(self):
        status, headers, _ = self.request(method='OPTIONS')
        self.assertEqual(status, 200)
        self.assertEqual(headers['Access-Control-Allow-Origin'], helper.ORIGIN)
        self.assertEqual(self.request(method='OPTIONS', origin='null')[0], 403)

    @patch('music_helper.subprocess.run')
    def test_only_fixed_script_is_executed(self, run):
        run.return_value.stdout = 'paused\n'
        status, _, result = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(result['state'], 'paused')
        self.assertEqual(run.call_args.args[0], ['/usr/bin/osascript', '-e', helper.SCRIPTS['status']])

    @patch('music_helper.subprocess.run', side_effect=OSError('denied'))
    def test_permission_failure_is_not_reported_as_success(self, run):
        status, _, result = self.request({'action': 'play'})
        self.assertEqual(status, 503)
        self.assertIn('Automation', result['error'])

if __name__ == '__main__':
    unittest.main()
